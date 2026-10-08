<?php
define('ABSPATH', '/');
define('ARRAY_A', 'ARRAY_A');
define('EXT_DB_USER', 'fixture');
define('EXT_DB_PASS', 'fixture');
define('EXT_DB_NAME', 'fixture');
define('EXT_DB_HOST', 'fixture');
define('EXT_DB_CHARSET', 'utf8mb4');
function current_time($format) { return date('Y-m-d H:i:s'); }
function get_current_user_id() { return 123; }
function add_action($event, $callback) { $callback(); }
function register_rest_route($namespace, $route, $options) { $GLOBALS['routes'][$route] = $options['callback']; }
function is_wp_error($value) { return $value instanceof WP_Error; }
class WP_Error {
    public function __construct(public $code, public $message, public $data) {}
}
class WP_REST_Request {
    public function __construct(private $params) {}
    public function get_param($key) { return $this->params[$key] ?? null; }
}
class wpdb {
    public $dbh;
    public $last_error = '';
    public $failInsert = '';
    public $failRead = false;
    public function __construct(...$args) { $this->dbh = new PDO('sqlite::memory:'); }
    public function set_charset(...$args) {}
    public function hide_errors() {}
    public function prepare($sql, ...$args) {
        foreach ($args as $arg) {
            $sql = preg_replace_callback('/%[sd]/', fn($m) => $m[0] === '%d' ? (string)(int)$arg : $this->dbh->quote((string)$arg), $sql, 1);
        }
        return $sql;
    }
    public function query($sql) {
        $this->last_error = '';
        if ($sql === 'START TRANSACTION') $sql = 'BEGIN';
        $sql = preg_replace('/\b(?:BIGINT UNSIGNED|INT)\b/', 'INTEGER', $sql);
        $sql = preg_replace('/INTEGER AUTO_INCREMENT PRIMARY KEY/', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
        $sql = preg_replace("/ENUM\('credit','debit'\)/", 'TEXT', $sql);
        $sql = str_replace(' ON UPDATE CURRENT_TIMESTAMP', '', $sql);
        $sql = preg_replace('/ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/', '', $sql);
        try { return $this->dbh->exec($sql); }
        catch (Throwable $e) { $this->last_error = $e->getMessage(); return false; }
    }
    public function get_row($sql, $format = null) {
        $this->last_error = '';
        if ($this->failRead) { $this->last_error = 'fixture read failure'; return null; }
        if (str_starts_with($sql, 'SHOW COLUMNS')) {
            $rows = $this->dbh->query('PRAGMA table_info(vf_ff_app_sessions)')->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) if ($row['name'] === 'last_seen_at') return ['Field' => 'last_seen_at'];
            return null;
        }
        try { return $this->dbh->query(str_replace(' FOR UPDATE', '', $sql))->fetch(PDO::FETCH_ASSOC) ?: null; }
        catch (Throwable $e) { $this->last_error = $e->getMessage(); return null; }
    }
    public function get_var($sql) {
        $row = $this->get_row($sql);
        return $row ? reset($row) : null;
    }
    public function insert($table, $data, $formats = null) {
        if ($this->failInsert === $table) { $this->last_error = 'fixture insert failure'; return false; }
        $columns = implode(',', array_keys($data));
        $values = implode(',', array_map(fn($v) => $v === null ? 'NULL' : $this->dbh->quote((string)$v), $data));
        return $this->query("INSERT INTO $table ($columns) VALUES ($values)");
    }
    public function update($table, $data, $where, ...$formats) {
        $assign = fn($values) => implode(' AND ', array_map(fn($key) => "$key=" . $this->dbh->quote((string)$values[$key]), array_keys($values)));
        return $this->query("UPDATE $table SET " . $assign($data) . ' WHERE ' . $assign($where));
    }
}
function check($value, $message) { if (!$value) throw new RuntimeException($message); }
function expect_error($callback, $message) {
    try { $callback(); } catch (Throwable $e) { check($e->getMessage() === $message, "Expected $message, got " . $e->getMessage()); return; }
    throw new RuntimeException("Expected rejection: $message");
}
$pluginDir = getenv('VF_FANFRAME_PLUGIN_DIR') ?: dirname(__DIR__) . '/vf-fanframe';
foreach (['Database', 'Installer', 'HandoffService', 'Security', 'CreditsWallet', 'Cors', 'RestRoutes'] as $name) require "$pluginDir/includes/$name.php";
use VFFanframe\Database;
use VFFanframe\HandoffService;
use VFFanframe\Installer;
use VFFanframe\Security;
$db = Database::ext();
if (getenv('REPRODUCE')) {
    $code = HandoffService::createCode(123);
    check(strlen($code) === 64, 'Original returns a code despite a missing table');
    expect_error(fn() => HandoffService::exchange($code), 'invalid_code');
    echo "Reproduced: missing table -> link issued -> invalid_code\n";
    exit;
}
// A missing table must never result in a usable-looking handoff link.
expect_error(fn() => HandoffService::createCode(123), 'handoff_write_failed');
Installer::install();
$db->dbh->exec('INSERT INTO vf_ff_image_credits_wallet (user_id,balance) VALUES (123,7)');
$code = HandoffService::createCode(123);
$session = HandoffService::exchange($code);
check(Security::userIdFromAppToken($session['app_token']) === 123, 'Issued session must be readable');
expect_error(fn() => HandoffService::exchange($code), 'code_consumed');
expect_error(fn() => HandoffService::exchange(str_repeat('0', 64)), 'invalid_code');
$expired = HandoffService::createCode(123, -1);
expect_error(fn() => HandoffService::exchange($expired), 'code_expired');
$pending = HandoffService::createCode(123);
$db->failInsert = 'vf_ff_app_sessions';
expect_error(fn() => HandoffService::exchange($pending), 'session_write_failed');
$db->failInsert = '';
check(Security::userIdFromAppToken($session['app_token']) === 123, 'Failed exchange must not revoke the previous session');
$retried = HandoffService::exchange($pending);
check(Security::userIdFromAppToken($retried['app_token']) === 123, 'Failed exchange must not consume code');
Installer::install();
check((int)$db->get_var('SELECT balance FROM vf_ff_image_credits_wallet WHERE user_id=123') === 7, 'Reactivation must preserve credits');
// Simulate upgrading the original schema without dropping existing sessions.
$db->dbh->exec('ALTER TABLE vf_ff_app_sessions DROP COLUMN last_seen_at');
Installer::install();
check(Security::userIdFromAppToken($retried['app_token']) === 123, 'Upgrade must add missing column and preserve sessions');
VFFanframe\RestRoutes::register();
$exchange = $GLOBALS['routes']['/handoff/exchange'];
$bad = $exchange(new WP_REST_Request(['code' => str_repeat('0', 64)]));
check($bad instanceof WP_Error && $bad->data['status'] === 401, 'Unknown code must remain unauthorized');
$db->failRead = true;
$failure = $exchange(new WP_REST_Request(['code' => str_repeat('0', 64)]));
check($failure instanceof WP_Error && $failure->data['status'] === 500, 'Database failure must not masquerade as invalid_code');
check(!str_contains($failure->message, 'fixture'), 'Database details must not leak');
$db->failRead = false;
echo "PASS: persistence failures, schema upgrade, exchange, token validation, one-use, expiration, rollback, REST errors, preserved credits\n";
