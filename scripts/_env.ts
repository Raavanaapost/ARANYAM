// Loads .env files the same way Next.js does, so scripts and the app agree.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
