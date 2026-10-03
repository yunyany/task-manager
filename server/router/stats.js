import express from 'express'
import auth from '../middleware.js'
import { exprieOverdueTasks } from '../middleware.js'
import pool from '../db.js'
import dayjs from 'dayjs'

const router = express.Router()
router.use(auth)

// 打卡 checkins库
router.post('/checkins', async (req, res) => {
    try {
        await pool.query(`
            insert into checkins(user_id,study_date)
            value(?,CURDATE())
        `, [req.user.id])
        res.status(201).json({ ok: true })
    }
    catch (err) {
        // 唯一约束冲突 = 今天已经打过卡了
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ tip: '今天已经打过卡了' })
        }
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 获取打卡内容 checkins库
router.get('/stats', async (req, res) => {
    try {
        await exprieOverdueTasks(req.user.id)
        const [taskRows] = await pool.query(`
            SELECT status, COUNT(*) AS n 
            FROM tasks WHERE user_id = ? GROUP BY status
            `, [req.user.id]
        )
        const [dateRows] = await pool.query(`
            select study_date from checkins where user_id = ? order by study_date desc
            `, [req.user.id]
        )

        const tasks = { done: 0, undone: 0, overdue: 0, total: 0 }
        for (const row of taskRows) {
            if (row.status === 0) tasks.undone = row.n
            else if (row.status === 1) tasks.done = row.n
            else if (row.status === 2) tasks.overdue = row.n
            tasks.total += row.n
        }


        //打卡日数组
        const dates = new Set(dateRows.map(r => r.study_date))
        //总打卡数目
        const punchDate = dates.size
        let todaydone = dates.has(dayjs().format("YYYY-MM-DD"))
        let streak = 0
        let cursor = dayjs().startOf('day')

        // 如果今天没打卡
        if (!dates.has(cursor.format('YYYY-MM-DD'))) {
            cursor = cursor.subtract(1, 'day')
        }
        while (dates.has(cursor.format('YYYY-MM-DD'))) {
            streak++
            cursor = cursor.subtract(1, 'day')
        }

        res.status(200).json({
            tasks: tasks,
            checkin: { total: punchDate, streak: streak, todaydone: todaydone }
        })

    }
    catch (err) {
        console.log(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 存入当前专注s
router.post('/time', async (req, res) => {
    try {
        const { mode, seconds, completed } = req.body
        await pool.query(`
        insert into study_sessions(user_id,mode,seconds,completed)
        values(?,?,?,?)
        `, [req.user.id, mode, seconds, completed])

        res.status(200).json({ ok: true })
    }
    catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 获取总时间
router.get('/allTime', async (req, res) => {
    try {
        const [rows] = await pool.query(`
        select seconds,completed,mode from study_sessions 
        where user_id = ? 
        `, [req.user.id])

        const data = rows
        const sumTime = data.reduce((sum, elem) => {
            if (elem.mode === 1) return sum + elem.seconds
            return sum
        }, 0)
        const over = data.reduce((sum, elem) => {
            if (elem.completed === 1) return sum + 1
            return sum
        }, 0)

        res.status(200).json({
            sumTime: sumTime,
            over: over
        })
    }
    catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

export default router;