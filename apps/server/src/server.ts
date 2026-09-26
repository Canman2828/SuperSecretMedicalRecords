import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './env.js';

async function main() {
  if (env.mongoUri) {
    await mongoose.connect(env.mongoUri);
    console.log('Connected to MongoDB');
  } else {
    console.warn('MONGODB_URI not set — running in guest-only mode (saving profiles is disabled).');
  }

  createApp().listen(env.port, '0.0.0.0', () => {
    console.log(`medify.Rx API on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
