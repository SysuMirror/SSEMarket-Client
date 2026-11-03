import { createRouter, createWebHistory } from 'vue-router'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'
import { installRouteScrollMemory } from '@/utils/routeScroll'
import { setTitle } from '@/utils/title'

const router = createRouter({
  history: createWebHistory(import.meta.env?.BASE_URL ?? '/'),
  routes: [
    {
      path: '/',
      name: 'Default',
      component: () => import('@/layouts/DefaultLayout.vue'),
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'course',
          name: 'Course',
          component: () => import('@/views/CourseView.vue'),
        },
        {
          path: 'save',
          name: 'Save',
          component: () => import('@/views/SaveView.vue'),
        },
        {
          path: 'history',
          name: 'History',
          component: () => import('@/views/HistoryView.vue'),
        },
        {
          path: 'rating',
          name: 'Rating',
          component: () => import('@/views/RatingView.vue'),
        },
        {
          path: 'rating/category/new',
          name: 'RatingCategoryNew',
          component: () => import('@/views/RatingCategoryCreateView.vue'),
        },
        {
          path: 'rating/post',
          name: 'RatingPost',
          component: () => import('@/views/RatingPostCreateView.vue'),
        },
        {
          path: 'rating/:id',
          name: 'RatingDetail',
          component: () => import('@/views/RatingDetailView.vue'),
          props: true,
        },
        {
          path: 'partition/打分',
          redirect: '/rating',
        },
        {
          path: 'novel',
          name: 'Novel',
          component: () => import('@/views/NovelView.vue'),
        },
        {
          path: 'novel/book/:id',
          name: 'NovelBook',
          component: () => import('@/views/NovelBookView.vue'),
          props: true,
        },
        {
          path: 'novel/read/:chapterID',
          name: 'NovelReader',
          component: () => import('@/views/NovelReaderView.vue'),
          props: true,
        },
        {
          path: 'novel/write',
          name: 'NovelWrite',
          component: () => import('@/views/NovelWriteView.vue'),
        },
        {
          path: 'novel/points',
          name: 'NovelPoints',
          component: () => import('@/views/NovelPointsView.vue'),
        },
        {
          path: 'partition/小说',
          redirect: '/novel',
        },
        {
          path: 'resume',
          name: 'Resume',
          component: () => import('@/views/ResumeView.vue'),
        },
        {
          path: 'resume/my',
          name: 'ResumeMy',
          component: () => import('@/views/ResumeView.vue'),
        },
        {
          path: 'resume/upload',
          name: 'ResumeUpload',
          component: () => import('@/views/ResumeUploadView.vue'),
        },
        {
          path: 'resume/:id',
          name: 'ResumeDetail',
          component: () => import('@/views/ResumeDetailView.vue'),
          props: true,
        },
        {
          path: 'search',
          name: 'Search',
          component: () => import('@/views/SearchView.vue'),
        },
        {
          path: 'rag-preview',
          redirect: to => ({
            name: 'Search',
            query: {
              sinfo: typeof to.query.q === 'string' ? to.query.q : '',
              smart: '1',
            },
          }),
        },
        {
          path: 'partitions',
          name: 'Partitions',
          component: () => import('@/views/PartitionListView.vue'),
        },
        {
          path: 'post',
          name: 'Post',
          meta: { layoutFill: true },
          component: () => import('@/views/PostView.vue'),
        },
        {
          path: 'partition/:name',
          name: 'Partition',
          component: () => import('@/views/PartitionView.vue'),
          props: true,
        },
        {
          path: 'postdetail/:id',
          name: 'Postdetail',
          component: () => import('@/views/PostDetailView.vue'),
          props: true,
        },
        {
          path: 'messages',
          name: 'Messages',
          meta: { layoutFill: true },
          component: () => import('@/views/MessagesView.vue'),
        },
        {
          path: 'notice',
          name: 'Notice',
          redirect: to => ({
            path: '/messages',
            query: { tab: 'notice', ...to.query },
          }),
        },
        {
          path: 'heat',
          name: 'Heat',
          component: () => import('@/views/HeatView.vue'),
        },
        {
          path: 'coin',
          name: 'Coin',
          component: () => import('@/views/CoinView.vue'),
        },
        {
          path: 'ranking',
          name: 'Ranking',
          component: () => import('@/views/RankingView.vue'),
        },
        {
          path: 'feedback',
          name: 'Feedback',
          component: () => import('@/views/FeedbackView.vue'),
        },
        {
          path: 'options',
          name: 'Options',
          component: () => import('@/views/OptionsView.vue'),
        },
        {
          path: 'user/:id',
          name: 'UserProfile',
          component: () => import('@/views/UserProfileView.vue'),
        },
        {
          path: 'chat',
          name: 'Chat',
          redirect: to => ({
            path: '/messages',
            query: { tab: 'chat', ...to.query },
          }),
        },
        {
          path: 'music',
          name: 'Music',
          component: () => import('@/views/MusicView.vue'),
        },
        {
          path: 'video',
          name: 'Video',
          meta: { public: true },
          component: () => import('@/views/VideoView.vue'),
        },
        {
          path: 'video/:videoID',
          name: 'VideoDetail',
          meta: { public: true },
          component: () => import('@/views/VideoDetailView.vue'),
          props: true,
        },
        {
          path: 'smart-xiaoqiu',
          name: 'SmartXiaoQiu',
          meta: { layoutFill: true },
          component: () => import('@/views/SmartXiaoQiuView.vue'),
        },
        {
          path: 'shop',
          name: 'ShopLayout',
          component: () => import('@/layouts/ShopLayout.vue'),
          children: [
            {
              path: '',
              name: 'Shop',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'myproducts',
              name: 'MyProducts',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'productdetail/:ProductID',
              name: 'Productdetail',
              component: () => import('@/views/ProductView.vue'),
              props: true,
            },
            {
              path: 'sale',
              name: 'Sale',
              component: () => import('@/views/SaleView.vue'),
            },
          ],
        },
        {
          path: 'workbench',
          name: 'Workbench',
          component: () => import('@/views/WorkbenchView.vue'),
        },

      ],
    },
    {
      path: '/auth/',
      name: 'Auth',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: 'login',
          name: 'Login',
          component: () => import('@/views/LoginView.vue'),
        },
        {
          path: 'register',
          name: 'Register',
          component: () => import('@/views/RegisterView.vue'),
        },
        {
          path: 'sso/result',
          name: 'SsoResult',
          component: () => import('@/views/SsoResultView.vue'),
        },
        {
          path: 'sso/bind',
          name: 'SsoBind',
          component: () => import('@/views/SsoBindView.vue'),
        },
        {
          path: 'reset',
          name: 'Reset',
          component: () => import('@/views/ResetView.vue'),
        },
      ],
    },
    {
      path: '/connect',
      name: 'Connect',
      component: () => import('@/views/ConnectView.vue'),
    },
    {
      path: '/annual2025',
      name: 'AnnualReport2025',
      component: () => import('@/views/AnnualReportView.vue'),
    },
    {
      path: '/embed/video/:videoID',
      name: 'VideoEmbed',
      meta: { public: true },
      component: () => import('@/views/VideoEmbedView.vue'),
      props: true,
    },
    {
      path: '/:catchAll(.*)',
      redirect: '/',
    },
  ],
})

const { isLogin, refreshToken } = useUserStore()

installRouteScrollMemory(router)

router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/auth')) {
    next()
    setTitle(to.name as string)
    return
  }
  if (to.meta.public) {
    next()
    setTitle(to.name as string)
    return
  }

  // 2025年度报告时间检测
  if (to.path === '/annual2025') {
    const now = new Date().getTime()
    const start = new Date('2026-01-20T00:00:00').getTime()
    const end = new Date('2026-02-27T23:59:59').getTime()

    if (now < start || now > end) {
      // 路由守卫里不弹阻塞框，走全局提示条
      showMsg('不在活动时间内', 'warning')
      next('/')
      return
    }
  }

  if (!isLogin.value) {
    if (refreshToken.value) {
      next()
      setTitle(to.name as string)
      return
    }

    let redirect = `redirect=${to.path}`
    const query = to.query
    for (const key in query) {
      const value = query[key]
      redirect = `${redirect}&${key}=${value}`
    }
    next(`/auth/login?${redirect}`)
    return
  }
  next()
  setTitle(to.name as string)
})

export default router
