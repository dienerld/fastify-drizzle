import { emptyMongo } from '~/test/db.mongo'
import { describeTodoRoutes } from './routes.contract'

describeTodoRoutes(emptyMongo)
