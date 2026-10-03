import express from 'express'
import pool from './db.js';
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import auth from './middleware.js';
import dayjs from 'dayjs'
import { exprieOverdueTasks } from './middleware.js';
 
const app = express()
// 让 Express 能读懂 JSON 格式的请求体（没有它 req.body 永远是 undefined）
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// function 

//登录请求 ok
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({
            tip: '密码或用户名不能为空'
        })
        return;
    }

    try {
        // 用 ? 占位符 + 数组传参，绝不字符串拼接（否则是 SQL 注入漏洞）
        const sqlstr = 'SELECT id, username, password_hash FROM users WHERE username = ?';
        const [rows] = await pool.query(sqlstr, [username]);
        //用户不存在
        if (rows.length === 0) {
            //提示词要全用一句话 
            return res.status(401).json({
                tip: '用户名或密码错误'
            })
        }
        // rows的格式为
        // [{ id:* ,username:*,pwd_hash:*}]
        const user = rows[0];
        //比较用户输入的密码和数据库里的密码哈希
        // bcrypt.compare(明文, 哈希) —— 参数顺序不能反，反了永远返回 false
        // 它做的事：用相同的盐重算一遍哈希再对比，所以不需要知道原密码
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({
                tip: '用户名或密码错误'
            })
        }

        // 【签发 token】
        // jwt.sign(payload, 密钥, 选项) 三个参数：
        //   payload —— 想装进 token 的数据，之后能用 verify 原样读回来。
        //              ⚠️ JWT 只是"签名"不是"加密"，payload 是 Base64 明文，
        //                 任何人拿去 jwt.io 都能解开看，所以别放密码等敏感信息！
        //   密钥    —— 相当于"印章"，只有拿着它的人才能签发和验证。
        //              泄露了别人就能伪造任意用户的 token，所以放在 .env 里不进 git
        //   选项    —— expiresIn: '7d' 表示 7 天后过期。
        //              必须有！永不过期的 token 一旦泄露就是永久后门
        const token = jwt.sign(
            {
                id: user.id, username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }//token失效期
        )

        // 只返回需要的字段，绝不能把整个 user 丢出去（那样 password_hash 就泄露了）
        res.json({
            token,
            user: { id: user.id, username: user.username }
        })
    } catch (err) {
        console.log(err)
        // 因为响应已经发出去了，再发一次会抛 ERR_HTTP_HEADERS_SENT
        if (res.headersSent) return;
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 中间件 auth 放在路径和处理函数中间，请求会先过关卡
app.get('/api/me', auth, async (req, res) => {
    try {
        // req.user.id 来自 auth 中间件解析出来的 token payload
        // 注意列名是 created_at，别拼错
        const sqlstr = 'select id,username,created_at from users where id = ?'
        const [rows] = await pool.query(sqlstr, [req.user.id])

        // token 有效不代表用户还在 —— token 是 7 天前签发的，这期间账号可能已被删除。
        // 所以涉及数据的操作要回查数据库，不能只信 token 里的旧信息
        if (rows.length === 0) {
            return res.status(401).json({ tip: '用户不存在' })
        }
        res.json({ user: rows[0] })
    }
    catch (err) {
        console.error(err)
        if (res.headersSent) return;
        res.status(500).json({ tip: '服务器出错了' })
    }
})

// 查询任务列表
app.get('/api/tasks', auth, async (req, res) => {
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
app.post('/api/tasks', auth, async (req, res) => {
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
app.put('/api/tasks/:id', auth, async (req, res) => {
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
app.delete('/api/tasks/:id', auth, async (req, res) => {
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

// 打卡 checkins库
app.post('/api/checkins', auth, async (req, res) => {
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
app.get('/api/stats', auth, async (req, res) => {
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

// 获取每日任务 tasks库
app.get('/api/everyday', auth, async (req, res) => {
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

// 存入当前专注s
app.post('/api/time', auth, async (req, res) => {
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
app.get('/api/allTime', auth, async (req, res) => {
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

// 注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body
        if (!username || !password) {
            return res.status(400).json({ tip: '用户名和密码不能为空' })
        }
        if (username.length > 50) {
            return res.status(400).json({ tip: '用户名不能超过 50 个字符' })
        }
        if (password.length < 6) {
            return res.status(400).json({ tip: '密码至少 6 位' })
        }

        const hash = await bcrypt.hash(password, 10)
        await pool.query(
            'insert into users(username,password_hash) values(?,?)',
            [username, hash]
        )
        res.status(201).json({ ok: true })
    }
    catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ tip: '用户名已被占用' })
        }
        console.error(err);
        if (res.headersSent) return
        res.status(500).json({ tip: '服务器出错了' })
    }
})

app.listen(8080, () => {
    console.log('server running at: http://127.0.0.1:8080')
})
