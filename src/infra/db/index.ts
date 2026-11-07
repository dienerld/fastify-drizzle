// The ONLY place that picks the database. To use another one, change these
// two lines to point at `./mongo` (see "Escolhendo o banco" in the README).
export { connect, loadEnv } from './postgres'
