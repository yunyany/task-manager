import mysql from 'mysql2/promise'

// 连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0, //无上限
    charset: 'utf8mb4',
    dateStrings:true //防止时区转换
})

export default pool