import { emptyMongo } from '~/test/db.mongo'
import { describeAuthRoutes } from './routes.contract'

describeAuthRoutes(emptyMongo)
