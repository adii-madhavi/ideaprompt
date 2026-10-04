import { Store } from "../src/lib/db";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const db = new Store();
console.log("SQLite migration 001 applied. Database is ready.");
db.close();
