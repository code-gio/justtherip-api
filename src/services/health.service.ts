export interface HealthResult {
  status: 'ok';
  timestamp: string;
}

export function getHealth(): HealthResult {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
