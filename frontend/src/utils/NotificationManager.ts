import notifee, { AndroidImportance, TriggerType, RepeatFrequency } from '@notifee/react-native';

export class NotificationManager {
  static async init() {
    try {
      // 1. Request permission (especially needed for Android 13+ and iOS)
      await notifee.requestPermission();

      // 2. Create Android notification channels
      await notifee.createChannel({
        id: 'reminders',
        name: 'Meal Reminders',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });

      await notifee.createChannel({
        id: 'recommendations',
        name: 'Daily Recommendations',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });
    } catch (e) {
      console.log('NotificationManager init error:', e);
    }
  }

  /**
   * Send a welcome notification immediately when the user logs in.
   */
  static async triggerLoginNotification(username: string = 'User') {
    try {
      await notifee.displayNotification({
        title: 'Welcome to Calorie Tracker! 🍏',
        body: `Hey ${username}, you have successfully signed in. Let's hit your calorie goals today!`,
        android: {
          channelId: 'reminders',
          smallIcon: 'ic_notification', // App logo icon
          color: '#E8497A',
          pressAction: {
            id: 'default',
          },
        },
      });
    } catch (e) {
      console.log('triggerLoginNotification error:', e);
    }
  }

  /**
   * Schedule reminders to upload food.
   */
  static async scheduleFoodReminders() {
    try {
      // Cancel existing trigger notifications first to prevent duplicates
      const triggerIds = await notifee.getTriggerNotificationIds();
      await Promise.all(triggerIds.map(id => notifee.cancelNotification(id)));

      // Schedule Lunch reminder at 13:00 (1 PM) daily
      const lunchTime = new Date();
      lunchTime.setHours(13, 0, 0, 0);
      if (lunchTime.getTime() < Date.now()) {
        lunchTime.setDate(lunchTime.getDate() + 1); // schedule for tomorrow if already passed
      }

      await notifee.createTriggerNotification(
        {
          id: 'lunch-reminder',
          title: 'Lunch Logging Reminder 🥗',
          body: "It's past midday! Have you logged your lunch yet? Keep your calorie tracking on streak!",
          android: {
            channelId: 'reminders',
            smallIcon: 'ic_notification',
            color: '#E8497A',
            pressAction: {
              id: 'default',
            },
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: lunchTime.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        }
      );

      // Schedule Dinner reminder at 20:00 (8 PM) daily
      const dinnerTime = new Date();
      dinnerTime.setHours(20, 0, 0, 0);
      if (dinnerTime.getTime() < Date.now()) {
        dinnerTime.setDate(dinnerTime.getDate() + 1);
      }

      await notifee.createTriggerNotification(
        {
          id: 'dinner-reminder',
          title: 'Dinner Logging Reminder 🍲',
          body: "Don't forget to log your dinner and wrap up your daily calorie budget!",
          android: {
            channelId: 'reminders',
            smallIcon: 'ic_notification',
            color: '#E8497A',
            pressAction: {
              id: 'default',
            },
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: dinnerTime.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        }
      );

      // Schedule Daily Recommendation at 10:00 AM daily
      const recoTime = new Date();
      recoTime.setHours(10, 0, 0, 0);
      if (recoTime.getTime() < Date.now()) {
        recoTime.setDate(recoTime.getDate() + 1);
      }

      await notifee.createTriggerNotification(
        {
          id: 'daily-reco',
          title: 'Today\'s Health Tip & Recommendation 💡',
          body: 'Check out custom recommendations based on your recent activity level to hit your weekly target.',
          android: {
            channelId: 'recommendations',
            smallIcon: 'ic_notification',
            color: '#E8497A',
            pressAction: {
              id: 'default',
            },
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: recoTime.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        }
      );
    } catch (e) {
      console.log('scheduleFoodReminders error:', e);
    }
  }

  /**
   * Cancel specific reminder if user logs a meal (e.g. lunch or dinner) for today.
   */
  static async cancelReminder(id: 'lunch-reminder' | 'dinner-reminder') {
    try {
      await notifee.cancelNotification(id);
    } catch (e) {
      console.log('cancelReminder error:', e);
    }
  }
}
