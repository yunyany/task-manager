import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/login/Login"
import Home from "../pages/home/Home"
import Nowaday from "../pages/nowaday/Nowaday"
import Task from "../pages/task/Task"
import Study from "../pages/study/Study"
import Publish from "../pages/publish/Publish";
import RequireAuth from "./requireAuth";
import Register from "../pages/register/Register";

const router = createBrowserRouter([
    {
        path: '/login',
        element: <Login />
    },
    {
        element: <RequireAuth />, // 路由守卫
        children: [{
            path: '/',
            element: <Home />,
            children: [
                { index: true, element: <Nowaday /> },
                { path: 'task', element: <Task /> },
                { path: 'study', element: <Study /> },
                { path: 'publish', element: <Publish /> },
            ]
        }]
    },
    {
        path:'/register',
        element:<Register />
    }

])

export default router;