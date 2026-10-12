import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  unocss: true,
  vue: true,
}, {
  rules: {
    'style/no-tabs': 'off',
    // 原生 alert/confirm/prompt 已全部换成自绘弹窗（ConfirmDialog / showMsg），
    // 开着这条规则防止再被写回来
    'no-alert': 'error',
    'no-console': 'off',
  },
})
