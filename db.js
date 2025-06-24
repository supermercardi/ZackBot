// db.js (Versão Final Completa para SQLite)
const Database = require('better-sqlite3');
const path = require('path');

// Cria ou abre o arquivo de banco de dados na mesma pasta do projeto
const db = new Database(path.join(__dirname, 'zackbot.sqlite'));

/**
 * Prepara uma declaração SQL para ser executada.
 * A preparação é feita uma vez para melhorar a performance.
 * @param {string} sql - O comando SQL a ser preparado.
 * @returns {import('better-sqlite3').Statement}
 */
const prepare = (sql) => db.prepare(sql);

/**
 * Inicializa o banco de dados, criando todas as tabelas necessárias se elas não existirem.
 */
const initDb = () => {
  console.log('Inicializando e verificando o banco de dados SQLite...');
  
  // Executa todos os comandos de criação de tabelas de uma vez
  db.exec(`
    CREATE TABLE IF NOT EXISTS authorized_groups ( group_jid TEXT PRIMARY KEY );
    CREATE TABLE IF NOT EXISTS bot_admins ( id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, admin_jid TEXT NOT NULL, UNIQUE(group_jid, admin_jid) );
    CREATE TABLE IF NOT EXISTS group_settings ( group_jid TEXT PRIMARY KEY, antilink_enabled BOOLEAN DEFAULT 1, welcome_enabled BOOLEAN DEFAULT 0, welcome_message TEXT DEFAULT 'Seja bem-vindo(a) @user ao grupo!', farewell_enabled BOOLEAN DEFAULT 0, farewell_message TEXT DEFAULT 'Até mais, @user...', warn_limit INTEGER DEFAULT 3, kickina_days INTEGER DEFAULT 14 );
    CREATE TABLE IF NOT EXISTS user_warnings ( id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, user_jid TEXT NOT NULL, issuer_jid TEXT NOT NULL, reason TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP );
    CREATE TABLE IF NOT EXISTS user_activity ( id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, user_jid TEXT NOT NULL, last_message_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_jid, user_jid) );
    CREATE TABLE IF NOT EXISTS group_participants ( id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, participant_jid TEXT NOT NULL, is_admin BOOLEAN DEFAULT 0, is_superadmin BOOLEAN DEFAULT 0, UNIQUE(group_jid, participant_jid) );
    CREATE TABLE IF NOT EXISTS muted_users ( id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, user_jid TEXT NOT NULL, muted_until DATETIME NOT NULL, UNIQUE(group_jid, user_jid) );
  `);
  console.log('✅ Banco de dados pronto.');
};

// --- Funções de Grupo ---
const authorizeGroup = (groupId, adminId) => {
    db.transaction(() => {
        prepare('INSERT OR IGNORE INTO authorized_groups (group_jid) VALUES (?)').run(groupId);
        prepare('INSERT OR IGNORE INTO bot_admins (group_jid, admin_jid) VALUES (?, ?)').run(groupId, adminId);
        prepare('INSERT OR IGNORE INTO group_settings (group_jid) VALUES (?)').run(groupId);
    })();
};
const unauthorizeGroup = (groupId) => {
    db.transaction(() => {
        prepare('DELETE FROM bot_admins WHERE group_jid = ?').run(groupId);
        prepare('DELETE FROM group_participants WHERE group_jid = ?').run(groupId);
        prepare('DELETE FROM authorized_groups WHERE group_jid = ?').run(groupId);
        prepare('DELETE FROM group_settings WHERE group_jid = ?').run(groupId);
    })();
};
const isGroupAuthorized = (groupId) => !!prepare('SELECT 1 FROM authorized_groups WHERE group_jid = ?').get(groupId);

// --- Funções de Admin do Bot ---
const addBotAdmin = (groupId, userId) => prepare('INSERT OR IGNORE INTO bot_admins (group_jid, admin_jid) VALUES (?, ?)').run(groupId, userId);
const removeBotAdmin = (groupId, userId) => prepare('DELETE FROM bot_admins WHERE group_jid = ? AND admin_jid = ?').run(groupId, userId);
const isUserBotAdmin = (groupId, userId) => !!prepare('SELECT 1 FROM bot_admins WHERE group_jid = ? AND admin_jid = ?').get(groupId, userId);

// --- Funções de Configurações de Grupo ---
const getGroupSettings = (groupId) => {
    const settings = prepare('SELECT * FROM group_settings WHERE group_jid = ?').get(groupId);
    if (settings) {
        settings.antilink_enabled = !!settings.antilink_enabled;
        settings.welcome_enabled = !!settings.welcome_enabled;
        settings.farewell_enabled = !!settings.farewell_enabled;
        return settings;
    }
    return { antilink_enabled: true, welcome_enabled: false, farewell_enabled: false, warn_limit: 3, kickina_days: 14, welcome_message: 'Seja bem-vindo(a) @user ao grupo!', farewell_message: 'Até mais, @user...' };
};
const updateGroupSetting = (groupId, settingKey, settingValue) => {
    const allowedKeys = ['antilink_enabled', 'welcome_enabled', 'welcome_message', 'farewell_enabled', 'farewell_message', 'warn_limit', 'kickina_days'];
    if (!allowedKeys.includes(settingKey)) {
        throw new Error(`Chave de configuração inválida: ${settingKey}`);
    }
    prepare(`UPDATE group_settings SET ${settingKey} = ? WHERE group_jid = ?`).run(settingValue, groupId);
};

// --- Funções de Advertências ---
const addWarning = (groupId, userId, issuerId, reason) => prepare('INSERT INTO user_warnings (group_jid, user_jid, issuer_jid, reason) VALUES (?, ?, ?, ?)').run(groupId, userId, issuerId, reason);
const countWarnings = (groupId, userId) => (prepare('SELECT COUNT(*) as count FROM user_warnings WHERE group_jid = ? AND user_jid = ?').get(groupId, userId)?.count || 0);
const clearWarnings = (groupId, userId) => prepare('DELETE FROM user_warnings WHERE group_jid = ? AND user_jid = ?').run(groupId, userId);

// --- Funções de Atividade ---
const recordUserActivity = (groupId, userId) => {
    prepare(`INSERT INTO user_activity (group_jid, user_jid, last_message_timestamp) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (group_jid, user_jid) DO UPDATE SET last_message_timestamp = CURRENT_TIMESTAMP;`).run(groupId, userId);
};

// --- Funções de Sincronização de Participantes ---
const syncGroupParticipants = (groupId, participants) => {
    const insert = prepare('INSERT OR REPLACE INTO group_participants (group_jid, participant_jid, is_admin, is_superadmin) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
        prepare('DELETE FROM group_participants WHERE group_jid = ?').run(groupId);
        for (const p of participants) {
            // CORREÇÃO: Converte o resultado booleano para 1 (true) ou 0 (false)
            insert.run(groupId, p.id, p.admin === 'admin' ? 1 : 0, p.admin === 'superadmin' ? 1 : 0);
        }
    })();
};

// --- Funções de Atividade (Adição) ---
const getInactiveUsers = (groupId, inactiveDays) => {
    // Esta consulta SQL seleciona todos os usuários de um grupo específico
    // cuja última mensagem foi registrada há mais tempo que o número de dias de inatividade.
    const sql = `
        SELECT user_jid 
        FROM user_activity 
        WHERE group_jid = ? 
          AND last_message_timestamp <= datetime('now', '-' || CAST(? AS TEXT) || ' days')
    `;
    // .all() retorna todos os resultados que correspondem à consulta.
    return prepare(sql).all(groupId, inactiveDays);
};

// --- Funções de Mute ---
const muteUser = (groupId, userId, durationInMinutes) => {
    prepare(`INSERT INTO muted_users (group_jid, user_jid, muted_until) VALUES (?, ?, datetime('now', '+${durationInMinutes} minutes')) ON CONFLICT (group_jid, user_jid) DO UPDATE SET muted_until = datetime('now', '+${durationInMinutes} minutes');`).run(groupId, userId);
};
const unmuteUser = (groupId, userId) => prepare('DELETE FROM muted_users WHERE group_jid = ? AND user_jid = ?').run(groupId, userId);
const isUserMuted = (groupId, userId) => !!prepare("SELECT 1 FROM muted_users WHERE group_jid = ? AND user_jid = ? AND muted_until > datetime('now')").get(groupId, userId);

// --- Exportações Completas ---
module.exports = { 
    initDb, 
    db,
    authorizeGroup,
    unauthorizeGroup,
    isGroupAuthorized,
    addBotAdmin,
    getInactiveUsers,
    removeBotAdmin,
    isUserBotAdmin,
    getGroupSettings,
    updateGroupSetting,
    addWarning,
    countWarnings,
    clearWarnings,
    recordUserActivity,
    syncGroupParticipants,
    muteUser,
    unmuteUser,
    isUserMuted,
};
