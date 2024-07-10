const c = global.chalk;
const Telegraf = global.telegraf;
const Keyboard = global.telegram_keyboard;
const { setConst, load, updateFile, getConst } = global.storage;
const log = global.log;

class TelegramBot {
    constructor(token) {
        this.bot = new Telegraf(token);

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        this.bot.catch((err) => {
            log(`Ошибка бота Telegram: ${err}`, 'r');
        })
    }

    async run() {
        this.setupListeners();
        await this.setupBot();

        this.bot.launch();
        log(`Управление через Telegram бота ${c.yellowBright(this.botInfo.username)} запущено.`, 'g');
    }

    async setupBot() {
        this.botInfo = await this.bot.telegram.getMe();
        this.bot.options.username = this.botInfo.username;

        this.mainKeyboard = this.getMainKeyboard();
        this.editGoodsKeyboard = this.getEditGoodsKeyboard();
        this.selectIssueTypeKeyboard = this.getSelectIssueTypeKeyboard();
        this.backKeyboard = this.getBackKeyboard();

        this.waitingForLotDelete = false;
        this.waitingForLotName = false;
        this.waitingForLotContent = false;
        this.waitingForDeliveryFile = false;

        this.lotType = '';
        this.lotName = '';
        this.lotContent = '';
        this.products = [];
    }

    setupListeners() {
        this.bot.on('text', (ctx) => this.onMessage(ctx));
        this.bot.on('document', (ctx) => this.onMessage(ctx));
        this.bot.on('inline_query', (ctx) => this.onInlineQuery(ctx));
    }
    
    async onMessage(ctx) {
        try {
            const msg = ctx.update.message.text;
            
            if(!this.isUserAuthed(ctx)) {
                ctx.reply('🚀 Приветствую! \nДля авторизации введите свой NickName в настройках FunPay Server, после чего перезапусти бота.');
                return;
            }
    
            if(msg == '🔥 Статус 🔥') {
                this.replyStatus(ctx);
                return;
            }
    
            if(msg == '🚀 Редактировать 🚀') {
                this.editAutoIssue(ctx);
                return;
            }

            if(msg == '🌐 Информация 🌐') {
                this.getInfo(ctx);
                return;
            }

            if(msg == '➕ Добавить товар ➕') {
                this.addProduct(ctx);
                return;
            }

            if(msg == '➖ Удалить товар ➖') {
                this.removeProduct(ctx);
                return;
            }

            if(msg == '🍀 Инструкция 🍀') {
                this.lotType = 'instruction';
                this.addProductName(ctx);
                return;
            }

            if(msg == '🎮 Аккаунты 🎮') {
                this.lotType = 'accounts';
                this.addProductName(ctx);
                return;
            }

            if(msg == '⬇️ Получить БД ⬇️') {
                await this.getAutoIssueFile(ctx);
                return;
            }

            if(msg == '⬆️ Загрузить БД ⬆️') {
                this.uploadAutoIssueFile(ctx);
                return;
            }

            if(msg == '🔙 Назад 🔙') {
                await this.back(ctx);
                return;
            }

            if(this.waitingForLotName) {
                await this.saveLotName(ctx);
                return;
            }

            if(this.waitingForLotContent) {
                await this.saveLotContent(ctx);
                return;
            }

            if(this.waitingForLotDelete) {
                await this.deleteLot(ctx);
                return;
            }

            if(this.waitingForDeliveryFile) {
                await this.onUploadDeliveryFile(ctx);
                return;
            }

            this.waitingForLotName = false;
            this.waitingForLotContent = false;
            this.waitingForLotDelete = false;
            this.waitingForDeliveryFile = false;
            
            ctx.reply('🏠 Главное Меню:', this.mainKeyboard.reply());
        } catch (err) {
            log(`Ошибка при обработке Telegram сообщения: ${err}`, 'r');
            ctx.reply(`Воу! Я словил ошибку... Не знаю как так получилось, но вот всё, что мне известно: ${err}`, this.mainKeyboard.reply());
        }
    }

    isUserAuthed(ctx) {
        if(global.settings.userName == ctx.update.message.from.username) {
            if(!getConst('chatId')) setConst('chatId', ctx.update.message.chat.id);
            return true;
        }
        return false;
    }

    getMainKeyboard() {
        const keyboard = Keyboard.make([
            ['🔥 Статус 🔥'],
            ['🚀 Редактировать 🚀'],
            ['🌐 Информация 🌐']
        ]);

        return keyboard;
    }

    getEditGoodsKeyboard() {
        const keyboard = Keyboard.make([
            ['➕ Добавить товар ➕', '➖ Удалить товар ➖'],
            ['⬇️ Получить БД ⬇️', '⬆️ Загрузить БД ⬆️'],
            ['🔙 Назад 🔙']
        ]);

        return keyboard;
    }

    getSelectIssueTypeKeyboard() {
        const keyboard = Keyboard.make([
            ['🍀 Инструкция 🍀'],
            ['🎮 Аккаунты 🎮'],
            ['🔙 Назад 🔙']
        ]);

        return keyboard;
    }

    getBackKeyboard() {
        const keyboard = Keyboard.make([
            ['🔙 Назад 🔙']
        ]);

        return keyboard;
    }

    async replyStatus(ctx) {
        const time = Date.now();
        const workTimeDiff = time - global.startTime;
        const lastUpdateTimeDiff = time - global.appData.lastUpdate;

        function declensionNum(num, words) {
            return words[(num % 100 > 4 && num % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(num % 10 < 5) ? num % 10 : 5]];
        }

        function msToTime(ms) {
            let days = ms > 0 ? Math.floor(ms / 1000 / 60 / 60 / 24) : 0;
            let hours = ms > 0 ? Math.floor(ms / 1000 / 60 / 60) % 24 : 0;
            let minutes = ms > 0 ? Math.floor(ms / 1000 / 60) % 60 : 0;
            let seconds = ms > 0 ? Math.floor(ms / 1000) % 60 : 0;
            days = ms < 10 ? '0' + days : days;
            hours = hours < 10 ? '0' + hours : hours;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            const daysTitle = declensionNum(days, ['день', 'дня', 'дней']);
            const hoursTitle = declensionNum(hours, ['час', 'часа', 'часов']);
            const minutesTitle = declensionNum(minutes, ['минута', 'минуты', 'минут']);
            const secondsTitle = declensionNum(seconds, ['секунда', 'секунды', 'секунд']);
            return {days: days, hours: hours, minutes: minutes, seconds: seconds, daysTitle: daysTitle, hoursTitle: hoursTitle, minutesTitle: minutesTitle, secondsTitle: secondsTitle};
        }

        const workTimeArr = msToTime(workTimeDiff);
        const workTime = `${workTimeArr.days} ${workTimeArr.daysTitle} ${workTimeArr.hours} ${workTimeArr.hoursTitle} ${workTimeArr.minutes} ${workTimeArr.minutesTitle} ${workTimeArr.seconds} ${workTimeArr.secondsTitle}`;

        const lastUpdateTimeArr = msToTime(lastUpdateTimeDiff);
        const lastUpdateTime = `${lastUpdateTimeArr.minutes} ${lastUpdateTimeArr.minutesTitle} ${lastUpdateTimeArr.seconds} ${lastUpdateTimeArr.secondsTitle}`;

        const autoIssue = (global.settings.autoIssue) ? 'Вкл' : 'Выкл';
        const alwaysOnline = (global.settings.alwaysOnline) ? 'Вкл' : 'Выкл';
        const lotsRaise = (global.settings.lotsRaise) ? 'Вкл' : 'Выкл';
        const goodsStateCheck = (global.settings.goodsStateCheck) ? 'Вкл' : 'Выкл';
        const autoResponse = (global.settings.autoResponse) ? 'Вкл' : 'Выкл';

        const msg = `🔥 <b>Статус</b> 🔥\n\n🔑 Аккаунт: <code>${global.appData.userName}</code>\n💰 Баланс: <code>${global.appData.balance}</code>\n🛍️ Продажи: <code>${global.appData.sales}</code>\n♻️ Последнее обновление: <code>${lastUpdateTime} назад</code>\n\n🕒 Время работы: <code>${workTime}</code>\n⏲ Всегда онлайн: <code>${alwaysOnline}</code>\n👾 Автоответ: <code>${autoResponse}</code>\n🚀 Автовыдача: <code>${autoIssue}</code>\n🏆 Автоподнятие предложений: <code>${lotsRaise}</code>\n🔨 Автовосстановление предложений: <code>${goodsStateCheck}</code>\n\n<a href="https://discord.gg/upd3RaXHhE">Ani Shop | RU 🌐</a>`;
        const params = this.mainKeyboard.reply();
        params.disable_web_page_preview = true;
        ctx.replyWithHTML(msg, params);
    }

    async editAutoIssue(ctx) {
        try {
            const goods = await load('data/configs/delivery.json');
            let goodsStr = '';

            let msg = `📄 <b>Список товаров</b> 📄`;
            await ctx.replyWithHTML(msg, this.editGoodsKeyboard.reply());
    
            for(let i = 0; i < goods.length; i++) {
                goodsStr += `[${i + 1}] ${goods[i].name}\n`;
    
                if(goodsStr.length > 3000) {
                    await ctx.replyWithHTML(goodsStr, this.editGoodsKeyboard.reply());
                    goodsStr = '';
                }

                if(i == (goods.length - 1)) {
                    await ctx.replyWithHTML(goodsStr, this.editGoodsKeyboard.reply());
                }
            }
        } catch (err) {
            log(`Ошибка при выдаче списка товаров: ${err}`, 'r');
        }
    }

    getInfo(ctx) {
        const msg = `🌐 <b>FunPay Server</b> 🌐\n\n<b>FunPay Server</b> - это бот для площадки <a href="https://funpay.com">FunPay</a> с открытым исходным кодом, разработанный <b>Shadow-Thunder04</b>.\n\nБольшое спасибо всем, кто поддерживает данный проект. \nОн живёт благодаря вам.\n\n<a href="https://github.com/Shadow-Thunder04/FunPay">GitHub</a> | <a href="https://sites.google.com/view/ani-shop-ru/реквезиты">Поддержать проект</a>`;
        ctx.replyWithHTML(msg);
    }

    addProduct(ctx) {
        ctx.replyWithHTML(`📃 Выбери тип предложения:`, this.selectIssueTypeKeyboard.reply());
    }

    addProductName(ctx) {
        ctx.replyWithHTML(`✔️ Хорошо, отправьте мне название предложения.\n🌐 Можешь просто скопирвать его из FunPay.\n😜 Эмодзи в названии поддерживаются.`);
        this.waitingForLotName = true;
    }

    removeProduct(ctx) {
        ctx.replyWithHTML(`⚙ Введите номер товара, который нужно удалить из списка автовыдачи:`);
        this.waitingForLotDelete = true;
    }

    async back(ctx) {
        this.waitingForLotName = false;
        this.waitingForLotContent = false;
        this.waitingForLotDelete = false;
        this.waitingForDeliveryFile = false;

        if(this.products.length > 0) {
            let goods = await load('data/configs/delivery.json');

            const product = {
                "name": this.lotName,
                "nodes": this.products
            }

            goods.push(product);
            await updateFile(goods, 'data/configs/delivery.json');
            this.products = [];
        }

        ctx.reply('🏠 Главное Меню:', this.mainKeyboard.reply());
    }

    async saveLotName(ctx) {
        const msg = ctx.update.message.text;

        this.waitingForLotName = false;
        this.lotName = msg;

        let replyMessage = 'Понял-принял. Теперь отправь мне сообщение, которое будет выдано покупателю после оплаты.';
        if(this.lotType == 'accounts') {
            replyMessage = 'Понял-принял. Теперь отправь мне сообщение, которое будет выдано покупателю после оплаты.\nТы можешь отправить несколько сообщений.\nКаждое сообщение будет выдано после каждой покупки.\nНажми "🔙 Назад 🔙" когда закончишь заполнять товар.';
        }

        ctx.reply(replyMessage, this.backKeyboard.reply());
        this.waitingForLotContent = true;
    }

    async saveLotContent(ctx) {
        const msg = ctx.update.message.text;

        this.lotContent = msg;
        let keyboard = this.backKeyboard;
        let goods = await load('data/configs/delivery.json');

        if(this.lotType != 'accounts') {
            this.waitingForLotContent = false;
            keyboard = this.mainKeyboard;

            const product = {
                "name": this.lotName,
                "message": this.lotContent
            }
    
            goods.push(product);
            await updateFile(goods, 'data/configs/delivery.json');

            this.lotName = '';
            this.lotContent = '';
        } else {
            keyboard = this.backKeyboard;

            this.products.push(msg);
        }

        ctx.reply(`✔️ Хорошо, сохранил товар.`, keyboard.reply());
    }

    async deleteLot(ctx) {
        const msg = ctx.update.message.text;
        this.waitingForLotDelete = false;

        let num = Number(msg);
        if(isNaN(num)) {
            ctx.reply(`❌ Что-то это не похоже на число...`, this.mainKeyboard.reply());
            return;
        }

        let goods = await load('data/configs/delivery.json');
        if(num > goods.length || num < 0) {
            ctx.reply(`❌ Такого ID нет в списке автовыдачи.`, this.mainKeyboard.reply());
            return;
        }

        let name = goods[num - 1].name;
        goods.splice(num - 1, 1);
        await updateFile(goods, 'data/configs/delivery.json');

        ctx.reply(`Хорошо, удалил товар "${name}" из списка автовыдачи.`, this.mainKeyboard.reply());
    }

    async getAutoIssueFile(ctx) {
        let contents = getConst('autoIssueFilePath');

        ctx.replyWithDocument({
            source: contents,
            filename: 'delivery.json'
        }).catch(function(error) { log(error); })
    }

    uploadAutoIssueFile(ctx) {
        this.waitingForDeliveryFile = true;
        ctx.reply(`📝 Пришли мне файл БД в формате JSON.`, this.backKeyboard.reply());
    }

    async onUploadDeliveryFile(ctx) {
        let file = ctx.update.message.document;
        let file_id = file.file_id;
        let file_name = file.file_name;
        let contents = null;

        if(file_name != 'delivery.json') {
            ctx.reply(`❌ Неверный формат файла.`, this.mainKeyboard.reply());
            return;
        }

        try {
            ctx.reply(`♻️ Загружаю файл...`);

            let file_path = await this.bot.telegram.getFileLink(file_id);
            let fileContents = await fetch(file_path);
            contents = await fileContents.text();
        } catch(e) {
            ctx.reply(`❌ Не удалось загрузить файл.`, this.mainKeyboard.reply());
            return;
        }

        try {
            ctx.reply(`♻️ Проверяю валидность...`);

            let json = JSON.parse(contents);
            await updateFile(json, 'data/configs/delivery.json');
            ctx.reply(`✔️ Обновил файл БД.`, this.editGoodsKeyboard.reply());
        } catch(e) {
            ctx.reply(`❌ Неверный формат JSON.`, this.mainKeyboard.reply());
        }
    }

    async onInlineQuery(ctx) {
        console.log(ctx);
    }

    getChatID() {
        let chatId = getConst('chatId');
        if(!chatId) {
            log(`Напишите своему боту в Telegram, чтобы он мог отправлять вам уведомления.`);
            return false;
        }
        return chatId;
    }

    async sendNewMessageNotification(message) {
        let msg = `💬 <b>Новое сообщение</b> от пользователя <b><i>${message.user}</i></b>.\n\n`;
        msg += `${message.content}\n\n`;
        msg += `<i>${message.time}</i> | <a href="https://funpay.com/chat/?node=${message.node}">Перейти в чат</a>`

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendNewOrderNotification(order) {
        let msg = `✔️ <b>Новый заказ</b> <a href="https://funpay.com/orders/${order.id.replace('#', '')}/">${order.id}</a> на сумму <b><i>${order.price} ${order.unit}</i></b>.\n\n`;
        msg += `👤 <b>Покупатель:</b> <a href="https://funpay.com/users/${order.buyerId}/">${order.buyerName}</a>\n`;
        msg += `🛍️ <b>Товар:</b> <code>${order.name}</code>`;

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendLotsRaiseNotification(category, nextTimeMsg) {
        let msg = `⬆️ Предложения в категории <a href="https://funpay.com/lots/${category.node_id}/trade">${category.name}</a> подняты.\n`;
        msg += `⌚ Следующее поднятие: <b><i>${nextTimeMsg}</i></b>`;

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendDeliveryNotification(buyerName, productName, message) {
        let msg = `📦 Товар <code>${productName}</code> выдан покупателю <b><i>${buyerName}</i></b> с сообщением:\n\n`;
        msg += `${message}`;

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }
}

export default TelegramBot;