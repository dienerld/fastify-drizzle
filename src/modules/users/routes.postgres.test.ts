import { emptyPostgres } from '~/test/db.postgres'
import { describeUserRoutes } from './routes.contract'

describeUserRoutes(emptyPostgres)
