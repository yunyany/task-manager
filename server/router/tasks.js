import express from 'express'
import auth from '../middleware'
import { exprieOverdueTasks } from '../middleware'
import pool from '../db'

const tasks = express.Router()

tasks.use(auth)

// 查询任务列表
tasks.get('/api/tasks', async (req, res) => {
    try {
        const { created_at, status, priority } = req.query
        //先把超时的任务打入冷宫(status=2)
        await exprieOverdueTasks(req.user.id)

        //获取用户选择的任务
        let sqlstr = `select id, title, description, status, priority, due_date, created_at, updated_at
                   from tasks
                   where user_id = ?`
        const params = [req.user.id]

        if (created_at) {
            sqlstr += ' and created_at >= ?'
            params.push(created_at)
        }
        if (status === '0' || status === '1' || status === '2') {
            sqlstr += ' and status = ?'
            params.push(Number(status))
        }
        if (priority === '1' || priority === '2' || priority === '3') {
            sqlstr += ' and priority = ?'
            params.push(Number(priority))
        }

        sqlstr += ' order by status asc, created_at desc'

        const [rows] = await pool.query(sqlstr, params)
        res.json({ tasks: rows })
    }
    catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 创建任务
tasks.post('/api/tasks', async (req, res) => {
    try {
        const { title, description = null, priority = 2, due_date = null } = req.body

        if (!title) {
            return res.status(400).json({ tip: '任务标题不能为空' })
        }
        const p = Number(priority)
        if (![1, 2, 3].includes(p)) {
            return res.status(400).json({ tip: '优先级不合法' })
        }

        // 列名里写 user_id，值里填 req.user.id（来自 token）。
        // 绝不能从 req.body 取 user_id，否则前端能伪造 {user_id: 别人的id} 把任务塞进别人账号
        const [result] = await pool.query(
            'insert into tasks (user_id, title, description, priority, due_date) values (?, ?, ?, ?, ?)',
            [req.user.id, title, description, priority, due_date]
        )

        // 插入成功后回查一次，这样才能拿到数据库刚生成的 created_at / updated_at
        // （insert 只返回 insertId，不返回整行数据）
        const [rows] = await pool.query(
            `select id, title, description, status, priority, due_date, created_at, updated_at
             from tasks where id = ? and user_id = ?`,
            [result.insertId, req.user.id]
        )

        res.status(201).json({ task: rows[0] })
    } catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 修改任务
tasks.put('/api/tasks/:id', async (req, res) => {
    try {
        const { status, title, description } = req.body

        if (![0, 1, 2].includes(Number(status))) {
            return res.status(400).json({ tip: '任务状态不合法' })
        }
        const [result] = await pool.query(
            `update tasks
             set status = ? , title = ? , description = ?
             where id = ? and user_id = ?`,
            [status, title, description, req.params.id, req.user.id]
        )

        // affectedRows === 0 有两种可能：任务不存在，或存在但不是你的
        // 故意不区分 —— 不给攻击者试探的机会
        if (result.affectedRows === 0) {
            return res.status(404).json({ tip: '任务不存在' })
        }

        // 回查一次，把刷新后的 updated_at 返回给前端
        const [rows] = await pool.query(
            `select id, title, description, status, priority, due_date, created_at, updated_at
             from tasks where id = ? and user_id = ?`,
            [req.params.id, req.user.id]
        )

        res.json({ task: rows[0] })
    } catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 删除任务
tasks.delete('/api/tasks/:id', async (req, res) => {
    try {
        const sqlstr = 'delete from tasks where id = ? and user_id = ?'
        const [result] = await pool.query(sqlstr, [req.params.id, req.user.id])

        if (result.affectedRows === 0) {
            return res.status(404).json({ tip: '任务不存在' })
        }

        res.json({ ok: true })
    } catch (err) {
        console.error(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 获取每日任务 tasks库
tasks.get('/api/everyday', async (req, res) => {
    try {
        await exprieOverdueTasks(req.user.id)
        const { due_date } = req.query
        //先暂时获取*
        const [rows] = await pool.query(`
            SELECT id,title,description,due_date,priority,created_at
            FROM tasks WHERE (due_date >= ? or due_date IS NULL) and user_id = ? and status = 0
            order by due_date ASC
            `, [due_date, req.user.id])

        res.status(200).json({ tasklist: rows })
    }
    catch (err) {
        console.log(err)
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

export default tasks;