import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "family_wall.db");
const db = new Database(dbPath);

const members = db.prepare("SELECT * FROM family_members").all();
const events = db.prepare("SELECT * FROM events").all();
const todos = db.prepare("SELECT * FROM todos").all();

console.log("Members:", members.length);
console.log("Events:", events.length);
console.log("Todos:", todos.length);
