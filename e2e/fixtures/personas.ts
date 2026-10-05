// Demo personas seeded by DemoSeeder (see docs/demo-personas.md). All share one
// password. Override via env if your demo build uses a different one.
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Demo@12345!';

export interface Persona {
  email: string;
  role: string;
}

export const Personas = {
  // Individual contributors
  emma:  { email: 'emma@pulse.demo',  role: 'engineer' },        // CIB+API member; one OMS task (assignee-fallback)
  frank: { email: 'frank@pulse.demo', role: 'engineer' },        // CIB only — OMS negative control
  grace: { email: 'grace@pulse.demo', role: 'engineer' },        // CIB + OMS (cross-team)
  // Leads / managers
  carol: { email: 'carol@pulse.demo', role: 'team_lead' },
  bob:   { email: 'bob@pulse.demo',   role: 'project_manager' }, // PMO group
  // Department heads
  nina:  { email: 'nina@pulse.demo',  role: 'head_of_pmo' },     // only role that can edit Thresholds
  alice: { email: 'alice@pulse.demo', role: 'head_of_rd' },      // can see Audit Log (HeadOnly)
  diana: { email: 'diana@pulse.demo', role: 'head_of_product' }, // Audit Log forbidden
} satisfies Record<string, Persona>;
