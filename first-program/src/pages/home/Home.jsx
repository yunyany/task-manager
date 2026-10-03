import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import './home.css'
import { Layout, Menu, Dropdown, Modal, message } from 'antd'
import classNames from 'classnames'
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearUser } from '../../store/modules/user';
import { changePwd } from '../../api/auth';


const { Header, Sider, Content } = Layout;
const str = ["/", "/task", "/study", "/publish"];
const items = ["今日概况", "任务管理", "学习日常", "添加任务"].map((key, i) => {
    return {
        key: str[i],
        label: key
    }
})
//下拉框的元素
const dropItems = [
    {
        label: <div>修改密码</div>,
        key: 'update'
    },
    {
        label: <div>退出登录</div>,
        key: 'logout'
    },
]

const Home = () => {
    const username = useSelector(i => i.user.username)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [userfold, setUserfold] = useState(false)
    const location = useLocation()
    const lightkey = location.pathname

    const [newPwd, setNewPwd] = useState('')
    const [oldPwd, setOldPwd] = useState('')
    const [confirmPwd, setConfirmPwd] = useState('')

    const [change, setChange] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    //退出登录
    const logout = () => {
        Modal.confirm({
            title: "是否要退出登录?",
            content: "退出登录后需要重新登录",
            closable: true,
            centered: true,
            okText: "往里豪^v^",
            cancelText: "反悔了",
            onOk() {
                dispatch(clearUser())
                navigate('/login')
                message.success('登出成功')
            },
            onCancel() {
                message.info("取消成功")
            }
        })

    }
 
    const onOk = async () => {
        if (!oldPwd || !newPwd || !confirmPwd) {
            message.warning('密码不能为空')
            return Promise.reject()
        }
        if (newPwd.length < 6) {
            message.warning('新密码至少需要6位');
            return Promise.reject()
        }
        if (newPwd !== confirmPwd) {
            message.warning('两次新密码不一致');
            return Promise.reject()
        }
        if(newPwd === oldPwd){
            message.warning('新密码不能与旧密码相同')
            return Promise.reject()
        }

        setIsSubmitting(true)
        try {
            await changePwd(oldPwd, newPwd)
            onCancel()
            message.success('密码已修改，请重新登录')
            dispatch(clearUser())
        }
        catch (err) {
            message.error(err.message)
            return Promise.reject()
        }
        finally {
            setIsSubmitting(false)
        }
    }

    const onCancel = () => {
        setConfirmPwd('')
        setOldPwd('')
        setNewPwd('')
        setChange(false)
    }

    return (
        <Layout className="geek-layout">
            {/* 左侧导航栏 */}
            <Sider
                breakpoint='md'
                width={'25vh'}
                className="home-sider" theme="dark">
                <div className="home-logo">首页</div>
                <Menu
                    mode="inline"
                    theme="dark"
                    items={items}
                    onClick={(item) => navigate(item.key)}
                    className="home-menu"
                    selectedKeys={[lightkey]}
                />
            </Sider>

            {/* 右侧内容区 */}
            <Layout className="home-content-wrap">
                {/* 顶栏 */}
                <Header className="home-header">
                    <Dropdown
                        menu={{
                            items: dropItems,
                            onClick: ({ key }) => {
                                if (key === 'logout') logout();
                                else if (key === 'update') setChange(true);
                            }
                        }}
                        trigger={['click']}
                        placement='bottom'
                        open={userfold}
                        //antd传入bool值
                        onOpenChange={setUserfold}
                    >
                        <div
                            className={'home-user-info'}
                        >
                            <span className="user-name">{'用户__' + username}</span>
                            <span className={classNames('arrow',
                                userfold ? 'unfold' : ''
                            )}></span>
                        </div>
                    </Dropdown>

                </Header>


                {/* 内容 */}
                <Content className="home-content" style={{ padding: 20 }}>
                    <Outlet />
                </Content>
            </Layout>
            <Modal
                title={'修改密码'}
                open={change}
                centered={true}
                onCancel={() => onCancel()}
                onOk={() => onOk()}
                okButtonProps={{
                    loading: isSubmitting
                }}
            >
                <div className='pwd-modal-content'>
                    <div className='pwd-modal-row'>
                        <label>旧密码:</label>
                        <input
                            value={oldPwd}
                            onChange={(e) => setOldPwd(e.target.value)}
                            type='password'
                            placeholder='请输入旧密码'
                        />
                    </div>
                    <div className='pwd-modal-row'>
                        <label>新密码:</label>
                        <input
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            type='password'
                            placeholder='请输入新密码'
                        />
                    </div>
                    <div className='pwd-modal-row'>
                        <label>确认新密码:</label>
                        <input
                            value={confirmPwd}
                            onChange={(e) => setConfirmPwd(e.target.value)}
                            type='password'
                            placeholder='请再次输入新密码'
                        />
                    </div>
                </div>
            </Modal>
        </Layout>
    );
}

export default Home