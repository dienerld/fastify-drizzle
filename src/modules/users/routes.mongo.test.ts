import { emptyMongo } from '~/test/db.mongo'
import { describeUserRoutes } from './routes.contract'

describeUserRoutes(emptyMongo)
