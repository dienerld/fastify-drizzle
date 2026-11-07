import { emptyPostgres } from '~/test/db.postgres'
import { describeTodoRoutes } from './routes.contract'

describeTodoRoutes(emptyPostgres)
