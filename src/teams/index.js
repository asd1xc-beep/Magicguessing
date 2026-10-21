export const teamRegistry = [
  {
    id: 'orlando',
    label: 'Orlando Magic',
    load: () => import('./orlando/index.js').then((module) => module.orlandoTeam),
  },
];

export async function loadTeam(teamId) {
  const descriptor = teamRegistry.find((team) => team.id === teamId);
  if (!descriptor) throw new Error(`Unknown team: ${teamId}`);
  return descriptor.load();
}

export function loadRegisteredTeams(registry = teamRegistry) {
  return Promise.all(registry.map((descriptor) => descriptor.load()));
}

