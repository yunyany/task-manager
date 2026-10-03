import express from 'express'

import auths from './router/auth.js';
import stats from './router/stats.js';
import tasks from './router/tasks.js';
 
const app = express()
app.use(express.json());
// function

app.use('/api',auths)
app.use('/api',stats)
app.use('/api',tasks)

app.listen(Number(process.env.PORT), () => {
    console.log('server running at: http://127.0.0.1:8080')
})
  