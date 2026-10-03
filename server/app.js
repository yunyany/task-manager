import express from 'express'

import authRouter from './router/auths.js';
import statsRouter from './router/stats.js';
import tasksRouter from './router/tasks.js';
 
const app = express()
app.use(express.json());
// function

app.use('/api',authRouter)
app.use('/api',statsRouter)
app.use('/api',tasksRouter)

app.listen(Number(process.env.PORT), () => {
    console.log('server running at: http://127.0.0.1:8080')
})
  