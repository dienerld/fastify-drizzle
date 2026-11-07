import { emptyPostgres } from '~/test/db.postgres'
import { describeAuthRoutes } from './routes.contract'

describeAuthRoutes(emptyPostgres)
