// 通知模块 - Capacitor Local Notifications
const Notify = (() => {
  let isNative = false;
  let LocalNotifications;

  async function init() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins.LocalNotifications) {
        LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        isNative = true;

        // 请求权限
        const perm = await LocalNotifications.requestPermissions();
        console.log('Notification permission:', perm);
      }
    } catch (e) {
      console.log('Notifications not available:', e);
    }
  }

  async function schedule(memo) {
    if (!isNative || !memo.datetime) return;

    const targetTime = new Date(memo.datetime);
    const now = new Date();

    // 只安排未来的通知
    if (targetTime <= now) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: memo.id,
          title: '备忘录提醒',
          body: memo.description,
          schedule: { at: targetTime },
          smallIcon: 'ic_stat_icon',
          largeIcon: 'ic_launcher',
          extra: { memoId: memo.id },
        }]
      });
    } catch (e) {
      console.error('Schedule notification failed:', e);
    }
  }

  async function cancel(memoId) {
    if (!isNative) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: memoId }] });
    } catch (e) {
      console.error('Cancel notification failed:', e);
    }
  }

  async function cancelAll() {
    if (!isNative) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
    } catch (e) {
      console.error('Cancel all notifications failed:', e);
    }
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  return { init, schedule, cancel, cancelAll, showToast };
})();
