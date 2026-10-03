import './nowaday.css';
import { message, Modal } from 'antd';
import { getStats, postNowaday, getTasklist } from '../../api/nowaday';
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { deleteTasks, updateTasks } from '../../api/tasks';


const Nowaday = () => {
    // 饼状图的数据
    const [stats, setStats] = useState(null)
    // 打卡请求进行中，用来禁用按钮防连点
    const [isPunching, setIsPunching] = useState(false)
    // 图表容器的 DOM 引用。ECharts 需要拿到真实的 DOM 元素才能画
    const chartRef = useRef(null)
    // 待完成任务列表数据
    const [tasklist, setTasklist] = useState(null)
    // 当前操作的任务
    const [operation, setOperation] = useState(null)
    //
    const [isActing, setIsActing] = useState(false)

    const handleDelete = async () => {
        if (isActing) return
        setIsActing(true)
        Modal.confirm({
            content: '确定删除?',
            centered: true,
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await deleteTasks(operation.id)
                    message.success('删除成功')
                    setOperation(null)
                    // 重新拉数据
                    loadStats()
                }
                catch (err) {
                    message.error(err.message)
                }
            },
            onCancel() {
                message.success('取消成功')
            }
        })

        setIsActing(false)
    }

    const handleDone = async () => {
        if (isActing) return
        setIsActing(true)
        try {
            await updateTasks(operation.id, {
                status: 1,
                title: operation.title,
                description: operation.description
            })
            message.success('完成任务')
            setOperation(null)
            loadStats()
        }
        catch (err) {
            message.error(err.message)
        }

        setIsActing(false)
    }

    //初始加载函数
    const loadStats = async () => {
        try {
            const data = await getStats()
            setStats(data)
            const taskdata = await getTasklist({ due_date: dayjs().format('YYYY-MM-DD') })
            setTasklist(taskdata.tasklist)
        }
        catch (err) {
            message.error(err.message)
        }
    }

    // 初始加载
    useEffect(() => {
        loadStats()
    }, [])

    //打卡
    const onPunch = async () => {
        if (isPunching) return
        setIsPunching(true)
        try {
            await postNowaday()      // 1. 先真的打卡
            await loadStats()        // 2. 成功了再重新拉统计数据
            // 为什么不直接 setStreak(streak+1)？
            // 因为连续天数的变化不是简单 +1：如果之前断了很久，
            // 打了卡之后 streak 是从 1 重新开始的。重新拉一次最可靠。
            message.success('打卡成功')
        }
        catch (err) {
            message.error(err.message)
        }
        setIsPunching(false)
    }

    // 画图
    useEffect(() => {
        if (!stats || !chartRef.current) return

        const chart = echarts.init(chartRef.current)

        chart.setOption({
            tooltip: { trigger: 'item' },
            legend: { bottom: '0%', left: 'center' },
            series: [
                {
                    name: '任务情况',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    itemStyle: {
                        borderRadius: 10,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    // 把标签直接画在扇区旁边，比只在 hover 时显示更容易看懂
                    label: {
                        show: true,
                        formatter: '{b}: {c}'
                    },
                    data: [
                        { value: stats.tasks.done, name: '已完成', itemStyle: { color: '#52c41a' } },
                        { value: stats.tasks.undone, name: '未完成', itemStyle: { color: '#faad14' } },
                        { value: stats.tasks.overdue, name: '已过期', itemStyle: { color: '#ff4d4f' } }
                    ]
                }
            ]
        })

        // 窗口大小变化时让图表跟着调整
        const onResize = () => chart.resize()
        window.addEventListener('resize', onResize)

        //    为什么每次都要 dispose 再 init？
        //    因为 echarts.init 在同一个 DOM 上调用两次会报警告，还会叠出多块画布。
        //    "先销毁旧的、再建新的" 是最简单可靠的做法
        return () => {
            window.removeEventListener('resize', onResize)
            chart.dispose()      // 销毁实例，释放画布
        }
    }, [stats])

    /* ⭐ 数据还没到就先返回"加载中"
       useEffect 是在【渲染之后】才执行的，所以第一帧渲染时 stats 还是 null。
       直接读 stats.checkin 就会报 "Cannot read properties of null"。
       这个 early return 必须放在所有 hook 调用【之后】—— hook 不能写在条件里。 */
    if (!stats) {
        return <div className='nowaday-container'>加载中...</div>
    }

    const { checkin, tasks } = stats
    // 如果暂时没有任务-->渲染另一个div
    const noTasks = tasks.total === 0

    return (
        <div className='nowaday-container'>
            <div className='nowaday-punch'>学习打卡</div>

            <div className='nowaday-num'>
                <span>已连续打卡天数:</span>
                <span>{checkin.streak + "天"}</span>
            </div>
            <div className='nowaday-num'>
                <span>累计打卡天数:</span>
                <span>{checkin.total + "天"}</span>
            </div>

            <div className='nowaday-today'>
                <span>今日打卡</span>
                <button
                    onClick={onPunch}
                    className={checkin.todaydone ? 'ispunch' : ''}
                    disabled={checkin.todaydone || isPunching}
                >
                    {checkin.todaydone ? "今日已打卡" : (isPunching ? "打卡中..." : "点击打卡")}
                </button>
            </div>

            <div className='nowaday-task-title'>任务情况</div>

            {noTasks ? (
                <div className='nowaday-chart-empty'>还没有任务，先去「添加任务」建一个吧</div>
            ) : (
                <div className='nowaday-chart' ref={chartRef}></div>
            )}

            <div className='nowaday-wait'>待完成任务
                <a style={{
                    fontSize: '24px',
                    color: 'red',
                    marginLeft: '10px'
                }}
                    onClick={() => {
                        Modal.warning({
                            content: '仅可进行对任务的删除与完成',
                            centered: true
                        })
                    }}
                >*tips</a>
            </div>

            <div className='nowaday-tasklist-show'>
                {
                    tasklist != null ?
                        (tasklist.length > 0 ? tasklist.map(i => (
                            <div
                                key={i.id}
                                className='nowaday-tasklist-item'
                                onClick={() => setOperation(i)}
                            >
                                <span className='tasklist-badge'>
                                    {'未完成'}
                                </span>
                                <h3 className='tasklist-title'>标题: {i.title}</h3>
                                内容:
                                <textarea
                                    style={{
                                        width: "80%",
                                        border: '1px solid #ddd',
                                        outline: 'none',
                                        borderRadius: '8px',
                                        padding: '4px 6px',
                                        marginTop: '5px',
                                    }}
                                    placeholder={i.description ? '' : '暂无内容'}
                                    readOnly
                                    value={i.description || ''}
                                    className='tasklist-desc'></textarea>
                                <div className='tasklist-other'>
                                    <span>发布时间:{i.created_at.slice(0, 16)}</span>
                                    <span>优先级:
                                        <span
                                            className={i.priority == 1 ? "high" : (
                                                i.priority == 2 ? "middle" : "low"
                                            )}
                                        >
                                            {i.priority == 1 ? "高" : (
                                                i.priority == 2 ? "中" : "低"
                                            )}
                                        </span>
                                    </span>

                                </div>
                                <span
                                    style={{
                                        fontSize: '13px',
                                        color: 'rgba(1,2,1,.5)'
                                    }}
                                >{i.due_date ? `截止时间: ${i.due_date.slice(0, 16)}` : '不限时'}</span>
                            </div>
                        ))
                            :
                            <div
                                className='nowaday-tasklist-none'
                            >{"暂无任务ヾ(≧▽≦*)o"}</div>
                        )
                        :
                        <div className='nowaday-tasklist-none'
                        >加载中...</div>
                }
            </div>
            <Modal
                open={!!operation}
                onCancel={() => setOperation(null)}
                footer={null}
                centered
                title="任务操作"
                width={520}
            >
                {operation && (
                    <div className="task-modal-content">
                        {/* 当前任务信息 */}
                        <div className="task-modal-info">
                            <span className="info-label">当前任务：</span>
                            <span className="info-title">{operation.title}</span>
                        </div>

                        {/* 操作按钮 */}
                        <div className="task-modal-actions">
                            <button
                                type="button"
                                className="btn-delete"
                                disabled={isActing}
                                onClick={handleDelete}
                            >
                                删除任务
                            </button>

                            <button
                                type="button"
                                className={`btn-done`}
                                disabled={isActing}
                                onClick={handleDone}
                            >
                                确认完成任务
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default Nowaday;
