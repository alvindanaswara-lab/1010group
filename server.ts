import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  updateUserProfileByUid,
  getAppStateRecord,
  saveAppStateRecord,
} from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // Authenticated User Profile Synchronization Endpoint
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || req.body?.email || '';
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      }

      const { username, position } = req.body || {};
      const dbUser = await getOrCreateUser(uid, email, username, position);
      return res.json({ user: dbUser });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to synchronize user';
      console.error('Error in /api/auth/sync:', error);
      return res.status(500).json({ error: message });
    }
  });

  // Update Authenticated User Profile in Cloud SQL
  app.put('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      }

      const { username, email, position, placement, outletName, department } = req.body || {};
      const updated = await updateUserProfileByUid(uid, {
        username,
        email,
        position,
        placement,
        outletName,
        department,
      });

      return res.json({ user: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user profile';
      console.error('Error in PUT /api/users/me:', error);
      return res.status(500).json({ error: message });
    }
  });

  // Fetch Application State Record from Cloud SQL
  app.get('/api/state/:key', requireAuth, async (req: AuthRequest, res) => {
    try {
      const stateKey = String(req.params.key || 'global_state');
      const record = await getAppStateRecord(stateKey);
      if (!record) {
        return res.json({ state: null });
      }
      return res.json({
        state: JSON.parse(record.stateJson),
        updatedAt: record.updatedAt,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch state';
      console.error('Error in GET /api/state/:key:', error);
      return res.status(500).json({ error: message });
    }
  });

  // Save Application State Record to Cloud SQL
  app.put('/api/state/:key', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      }

      const stateKey = String(req.params.key || 'global_state');
      const dbUser = await getOrCreateUser(uid, email);
      const stateJson = JSON.stringify(req.body?.state ?? {});
      const saved = await saveAppStateRecord(stateKey, stateJson, uid, dbUser?.id);

      return res.json({
        success: true,
        updatedAt: saved?.updatedAt,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save state';
      console.error('Error in PUT /api/state/:key:', error);
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
