const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// все пути собираю относительно текущего файла, а не рабочей папки терминала.
// так приложение можно запускать из разных директорий
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// форма отправляет обычные HTML-поля, поэтому здесь подходит urlencoded.
// extended: true позволяет Express корректно разобрать более сложные значения, если в форме появятся повторяющиеся или вложенные поля.
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/*
 * данные пока хранятся в JSON, чтобы структуру можно открыть и посмотреть обычным текстовым редактором.
 *
 * чтение и запись оставила синхронными намеренно
 * если брать большой проект или параллельную нагрузку, я бы выбрала БД =)
 */
function readData() {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(fileContent);
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// поиск вынесла в отдельную функцию, потому что форма нужна в нескольких маршрутах.
// избавляемся от повторения
function findFormById(forms, id) {
    return forms.find((form) => form.id === id);
}

// панель управления 
app.get('/admin', (req, res) => {
    const data = readData();
    res.render('admin', { forms: data.forms });
});

// создание формы - браузер отправляет fieldLabel и fieldType для каждого вопроса.
// если вопрос только один, Express может вернуть строку, а не массив, поэтому привожу оба значения к массивам перед map().
app.post('/admin/create', (req, res) => {
    const data = readData();

    const titles = Array.isArray(req.body.fieldLabel)
        ? req.body.fieldLabel
        : [req.body.fieldLabel];

    const types = Array.isArray(req.body.fieldType)
        ? req.body.fieldType
        : [req.body.fieldType];

    // каждому вопросу свой id. на него будут ссылаться ответы, поэтому не использую сам текст вопроса в качестве ключа (пользователь может изменить формулировку) 
    const fields = titles.map((title, index) => ({
        id: `field_${index}`,
        label: title,
        type: types[index]
    }));

    const newForm = {
        // UUID не зависит от порядкового номера формы и снижает риск совпадения id.
        id: crypto.randomUUID(),
        title: req.body.title,
        fields,
        responses: []
    };

    data.forms.push(newForm);
    writeData(data);

    // после POST перенаправляю на список, чтобы обновить страницу
    // не предлагая браузеру повторно отправить ту же форму при обновлении.
    res.redirect('/admin');
});

// публичная страница
app.get('/form/:id', (req, res) => {
    const data = readData();
    const form = findFormById(data.forms, req.params.id);

    if (!form) {
        return res.status(404).send('Форма не найдена');
    }

    res.render('form', { form });
});

// сохранение заполненной формы
app.post('/form/:id', (req, res) => {
    const data = readData();
    const form = findFormById(data.forms, req.params.id);

    if (!form) {
        return res.status(404).send('Форма не найдена');
    }

    // сохранение сделала с датой отправки чтобы админ видел когда именно был получен каждый ответ.
    form.responses.push({
        answers: req.body,
        date: new Date().toISOString()
    });

    writeData(data);

    res.render('success');
});

// просмотр ответов конкретной формы
app.get('/admin/forms/:id', (req, res) => {
    const data = readData();
    const form = findFormById(data.forms, req.params.id);

    if (!form) {
        return res.status(404).send('Форма не найдена');
    }

    res.render('responses', { form });
});

// обработчик 404 в конце: до него доходят запросы, для которых не нашлось подходящего маршрута.
app.use((req, res) => {
    res.status(404).send('Страница не найдена');
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}/admin`);
});
