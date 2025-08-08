/*! VKID SDK - локальная копия */
console.warn("VKID SDK локальная версия заглушка. Подключите рабочую версию от VK.");

window.VKIDSDK = {
  Config: {
    init: function(opts) {
      console.log("VKID Config.init", opts);
    },
    ConfigResponseMode: { Callback: "callback" },
    ConfigSource: { LOWCODE: "lowcode" }
  },
  OneTap: function() {
    return {
      render: function(opts) {
        console.log("VKID OneTap.render", opts);
        return this;
      },
      on: function(evt, handler) {
        console.log("VKID OneTap.on", evt);
        return this;
      }
    };
  },
  WidgetEvents: { ERROR: "error" },
  OneTapInternalEvents: { LOGIN_SUCCESS: "login_success" },
  Auth: {
    exchangeCode: function(code, deviceId) {
      console.log("VKID Auth.exchangeCode", code, deviceId);
      return Promise.resolve({ access_token: "demo_token" });
    }
  }
};
