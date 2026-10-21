import { teamRegistry, loadTeam } from './teams/index.js';
import { createApp } from './ui/app.js';

const app = createApp({
  document,
  storage: window.localStorage,
  registry: teamRegistry,
  loadTeam,
});

app.start().catch((error) => {
  console.error(error);
  const message = document.getElementById('guess-message');
  if (message) message.textContent = 'The game could not start. Please refresh and try again.';
});

