// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====
Handlebars.templates = {};

async function loadTemplates() {
    const templates = [
        'Button',
        'Input',
        'Avatar',
        'UserPhotoItem'
    ];

    for (const name of templates) {
        try {
            const response = await fetch(`/components/atoms/${name}/${name}.hbs`);
            const source = await response.text();
            Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
            console.log(`✅ Loaded template: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to load template ${name}:`, error);
        }
    }
}

// ===== ДЕМОНСТРАЦИЯ ВСЕХ СОСТОЯНИЙ КОМПОНЕНТОВ =====
async function demoAllComponents() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    
    // Заголовок
    const title = document.createElement('h1');
    title.textContent = 'SPORT.tech - Базовые компоненты';
    title.style.margin = '20px';
    title.style.color = 'var(--base-purple)';
    app.appendChild(title);
    
    // Контейнер для демо
    const demoContainer = document.createElement('div');
    demoContainer.style.display = 'flex';
    demoContainer.style.flexDirection = 'column';
    demoContainer.style.gap = '40px';
    demoContainer.style.padding = '20px';
    demoContainer.style.maxWidth = '1200px';
    demoContainer.style.margin = '0 auto';
    app.appendChild(demoContainer);

    // ===== 1. ДЕМО КНОПОК =====
    const buttonSection = document.createElement('div');
    buttonSection.innerHTML = '<h2 style="margin-bottom: 20px; font-family: var(--font-heading);">Кнопки (оранжевые и синие)</h2>';
    demoContainer.appendChild(buttonSection);

    const { renderButton, BUTTON_VARIANTS, BUTTON_STATES, BUTTON_SIZES } = await import('/components/atoms/Button/Button.js');

    // Контейнер для всех кнопок в две колонки
    const buttonsGrid = document.createElement('div');
    buttonsGrid.style.display = 'grid';
    buttonsGrid.style.gridTemplateColumns = '1fr 1fr';
    buttonsGrid.style.gap = '30px';
    buttonsGrid.style.maxWidth = '600px';
    buttonSection.appendChild(buttonsGrid);

    // Левая колонка
    const leftColumn = document.createElement('div');
    leftColumn.style.display = 'flex';
    leftColumn.style.flexDirection = 'column';
    leftColumn.style.gap = '20px';
    buttonsGrid.appendChild(leftColumn);

    // Правая колонка
    const rightColumn = document.createElement('div');
    rightColumn.style.display = 'flex';
    rightColumn.style.flexDirection = 'column';
    rightColumn.style.gap = '20px';
    buttonsGrid.appendChild(rightColumn);

    // ===== ЛЕВАЯ КОЛОНКА =====

    // Оранжевые кнопки
    const orangeTitle = document.createElement('div');
    orangeTitle.textContent = 'Оранжевые';
    orangeTitle.style.fontFamily = 'var(--font-body)';
    orangeTitle.style.fontWeight = '500';
    orangeTitle.style.marginBottom = '8px';
    orangeTitle.style.color = 'var(--text-secondary)';
    leftColumn.appendChild(orangeTitle);

    const orangeButtons = document.createElement('div');
    orangeButtons.style.display = 'flex';
    orangeButtons.style.flexDirection = 'column';
    orangeButtons.style.gap = '10px';
    orangeButtons.style.marginBottom = '20px';
    leftColumn.appendChild(orangeButtons);

    await renderButton(orangeButtons, { 
        text: 'Войти', 
        variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
        size: BUTTON_SIZES.MEDIUM
    });

    await renderButton(orangeButtons, { 
        text: 'Зарегистрироваться', 
        variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
        size: BUTTON_SIZES.MEDIUM
    });

    // Синие кнопки
    const blueTitle = document.createElement('div');
    blueTitle.textContent = 'Синие';
    blueTitle.style.fontFamily = 'var(--font-body)';
    blueTitle.style.fontWeight = '500';
    blueTitle.style.marginBottom = '8px';
    blueTitle.style.color = 'var(--text-secondary)';
    leftColumn.appendChild(blueTitle);

    const blueButtons = document.createElement('div');
    blueButtons.style.display = 'flex';
    blueButtons.style.flexDirection = 'column';
    blueButtons.style.gap = '10px';
    blueButtons.style.marginBottom = '20px';
    leftColumn.appendChild(blueButtons);

    await renderButton(blueButtons, { 
        text: 'Я тренер', 
        variant: BUTTON_VARIANTS.SECONDARY_BLUE,
        size: BUTTON_SIZES.MEDIUM
    });

    await renderButton(blueButtons, { 
        text: 'Я спортсмен', 
        variant: BUTTON_VARIANTS.SECONDARY_BLUE,
        size: BUTTON_SIZES.MEDIUM
    });

    // ===== ПРАВАЯ КОЛОНКА =====

    // Текстовые оранжевые
    const textOrangeTitle = document.createElement('div');
    textOrangeTitle.textContent = 'Текстовые оранжевые';
    textOrangeTitle.style.fontFamily = 'var(--font-body)';
    textOrangeTitle.style.fontWeight = '500';
    textOrangeTitle.style.marginBottom = '8px';
    textOrangeTitle.style.color = 'var(--text-secondary)';
    rightColumn.appendChild(textOrangeTitle);

    const textOrangeButtons = document.createElement('div');
    textOrangeButtons.style.display = 'flex';
    textOrangeButtons.style.flexDirection = 'column';
    textOrangeButtons.style.gap = '10px';
    textOrangeButtons.style.marginBottom = '20px';
    rightColumn.appendChild(textOrangeButtons);

    await renderButton(textOrangeButtons, { 
        text: 'Войти', 
        variant: BUTTON_VARIANTS.TEXT_ORANGE,
        size: BUTTON_SIZES.SMALL
    });

    await renderButton(textOrangeButtons, { 
        text: 'Зарегистрироваться', 
        variant: BUTTON_VARIANTS.TEXT_ORANGE,
        size: BUTTON_SIZES.SMALL
    });

    // Текстовые синие (как на скриншоте: "Уже есть аккаунт? Войти")
    const textBlueContainer = document.createElement('div');
    textBlueContainer.style.display = 'flex';
    textBlueContainer.style.alignItems = 'center';
    textBlueContainer.style.gap = '8px';
    textBlueContainer.style.marginTop = '10px';
    rightColumn.appendChild(textBlueContainer);

    // Текст "Уже есть аккаунт?" (обычный текст, не кнопка)
    const questionText = document.createElement('span');
    questionText.textContent = 'Уже есть аккаунт?';
    questionText.style.fontFamily = 'var(--font-body)';
    questionText.style.fontSize = 'var(--font-size-sm)';
    questionText.style.color = 'var(--text-secondary)';
    textBlueContainer.appendChild(questionText);

    // Кнопка "Войти" (текстовая синяя)
    await renderButton(textBlueContainer, { 
        text: 'Войти', 
        variant: BUTTON_VARIANTS.TEXT_BLUE,
        size: BUTTON_SIZES.SMALL
    });

    // Дополнительно: пример с двумя текстовыми кнопками
    const textBlueButtons = document.createElement('div');
    textBlueButtons.style.display = 'flex';
    textBlueButtons.style.gap = '16px';
    textBlueButtons.style.marginTop = '10px';
    rightColumn.appendChild(textBlueButtons);

    await renderButton(textBlueButtons, { 
        text: 'Войти', 
        variant: BUTTON_VARIANTS.TEXT_BLUE,
        size: BUTTON_SIZES.SMALL
    });

    await renderButton(textBlueButtons, { 
        text: 'Зарегистрироваться', 
        variant: BUTTON_VARIANTS.TEXT_BLUE,
        size: BUTTON_SIZES.SMALL
    });

    // Добавляем разделитель
    const divider = document.createElement('hr');
    divider.style.margin = '40px 0';
    divider.style.border = 'none';
    divider.style.borderTop = '1px solid var(--border-light)';
    demoContainer.appendChild(divider);
    
    // ===== 2. ДЕМО ИНПУТОВ (ВСЕ СОСТОЯНИЯ ИЗ UI KIT) =====
    const inputSection = document.createElement('div');
    inputSection.innerHTML = '<h2 style="margin: 30px 0 20px;">Input - все состояния</h2>';
    demoContainer.appendChild(inputSection);

    const { renderInput, INPUT_TYPES, INPUT_STATES, EYE_STATES } = await import('/components/atoms/Input/Input.js');

    // Normal состояния
    const normalInputTitle = document.createElement('h3');
    normalInputTitle.textContent = 'Normal состояния:';
    normalInputTitle.style.margin = '10px 0';
    inputSection.appendChild(normalInputTitle);

    const normalInputContainer = document.createElement('div');
    normalInputContainer.style.display = 'grid';
    normalInputContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    normalInputContainer.style.gap = '20px';
    normalInputContainer.style.marginBottom = '30px';
    inputSection.appendChild(normalInputContainer);

    await renderInput(normalInputContainer, { type: INPUT_TYPES.MAIL, label: 'Mail - Normal', placeholder: 'email@example.com' });
    await renderInput(normalInputContainer, { type: INPUT_TYPES.PASSWORD, label: 'Password - Normal', showEye: true });
    await renderInput(normalInputContainer, { type: INPUT_TYPES.NAME, label: 'Name - Normal', placeholder: 'Иван Иванов' });
    await renderInput(normalInputContainer, { type: INPUT_TYPES.WITHOUTS, label: 'Withouts - Normal', placeholder: 'Обычное поле' });

    // Active состояния
    const activeInputTitle = document.createElement('h3');
    activeInputTitle.textContent = 'Active (в фокусе):';
    activeInputTitle.style.margin = '10px 0';
    inputSection.appendChild(activeInputTitle);

    const activeInputContainer = document.createElement('div');
    activeInputContainer.style.display = 'grid';
    activeInputContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    activeInputContainer.style.gap = '20px';
    activeInputContainer.style.marginBottom = '30px';
    inputSection.appendChild(activeInputContainer);

    await renderInput(activeInputContainer, { type: INPUT_TYPES.MAIL, state: INPUT_STATES.ACTIVE, label: 'Mail - Active', value: 'user@example.com' });
    await renderInput(activeInputContainer, { type: INPUT_TYPES.PASSWORD, state: INPUT_STATES.ACTIVE, label: 'Password - Active', showEye: true, value: 'password123' });

    // Error состояния
    const errorInputTitle = document.createElement('h3');
    errorInputTitle.textContent = 'Error (ошибки):';
    errorInputTitle.style.margin = '10px 0';
    inputSection.appendChild(errorInputTitle);

    const errorInputContainer = document.createElement('div');
    errorInputContainer.style.display = 'grid';
    errorInputContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    errorInputContainer.style.gap = '20px';
    errorInputContainer.style.marginBottom = '30px';
    inputSection.appendChild(errorInputContainer);

    await renderInput(errorInputContainer, { 
        type: INPUT_TYPES.MAIL, 
        state: INPUT_STATES.ERROR, 
        label: 'Mail - Error', 
        value: 'wrong-email',
        message: 'Неверный формат email' 
    });
    
    await renderInput(errorInputContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        state: INPUT_STATES.ERROR, 
        label: 'Password - Error', 
        showEye: true,
        message: 'Слишком простой пароль' 
    });

    // Warning состояния
    const warningInputTitle = document.createElement('h3');
    warningInputTitle.textContent = 'Warning (предупреждения):';
    warningInputTitle.style.margin = '10px 0';
    inputSection.appendChild(warningInputTitle);

    const warningInputContainer = document.createElement('div');
    warningInputContainer.style.display = 'grid';
    warningInputContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    warningInputContainer.style.gap = '20px';
    warningInputContainer.style.marginBottom = '30px';
    inputSection.appendChild(warningInputContainer);

    await renderInput(warningInputContainer, { 
        type: INPUT_TYPES.MAIL, 
        state: INPUT_STATES.WARNING, 
        label: 'Mail - Warning', 
        value: 'used@email.com',
        message: 'Этот email уже используется' 
    });
    
    await renderInput(warningInputContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        state: INPUT_STATES.WARNING, 
        label: 'Password - Warning', 
        showEye: true,
        message: 'Пароли не совпадают' 
    });

    // Correct состояния
    const correctInputTitle = document.createElement('h3');
    correctInputTitle.textContent = 'Correct (правильно заполнено):';
    correctInputTitle.style.margin = '10px 0';
    inputSection.appendChild(correctInputTitle);

    const correctInputContainer = document.createElement('div');
    correctInputContainer.style.display = 'grid';
    correctInputContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    correctInputContainer.style.gap = '20px';
    correctInputContainer.style.marginBottom = '30px';
    inputSection.appendChild(correctInputContainer);

    await renderInput(correctInputContainer, { 
        type: INPUT_TYPES.MAIL, 
        state: INPUT_STATES.CORRECT, 
        label: 'Mail - Correct', 
        value: 'user@example.com',
        message: 'Email доступен' 
    });
    
    await renderInput(correctInputContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        state: INPUT_STATES.CORRECT, 
        label: 'Password - Correct', 
        showEye: true,
        value: 'StrongPass123',
        message: 'Надёжный пароль' 
    });

    // Глазок (все состояния)
    const eyeTitle = document.createElement('h3');
    eyeTitle.textContent = 'Глазок - все состояния:';
    eyeTitle.style.margin = '10px 0';
    inputSection.appendChild(eyeTitle);

    const eyeContainer = document.createElement('div');
    eyeContainer.style.display = 'grid';
    eyeContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    eyeContainer.style.gap = '20px';
    eyeContainer.style.marginBottom = '30px';
    inputSection.appendChild(eyeContainer);

    await renderInput(eyeContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        label: 'Close Eye Non Active', 
        showEye: true, 
        eyeState: EYE_STATES.NON_ACTIVE 
    });
    
    await renderInput(eyeContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        label: 'Open Eye Non Active', 
        showEye: true, 
        eyeState: EYE_STATES.ACTIVE 
    });
    
    await renderInput(eyeContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        state: INPUT_STATES.ERROR,
        label: 'Close Eye + Error', 
        showEye: true, 
        eyeState: EYE_STATES.NON_ACTIVE,
        message: 'Bad Password'
    });
    
    await renderInput(eyeContainer, { 
        type: INPUT_TYPES.PASSWORD, 
        state: INPUT_STATES.CORRECT,
        label: 'Open Eye + Correct', 
        showEye: true, 
        eyeState: EYE_STATES.ACTIVE,
        value: 'StrongPass123',
        message: 'Password Correct'
    });

    // ===== 3. ДЕМО АВАТАРОВ =====
    const avatarSection = document.createElement('div');
    avatarSection.innerHTML = '<h2 style="margin: 40px 0 20px; font-family: var(--font-heading);">Avatar - размеры и состояния</h2>';
    demoContainer.appendChild(avatarSection);

    const { renderAvatar, AVATAR_SIZES } = await import('/components/atoms/Avatar/Avatar.js');

    const avatarContainer = document.createElement('div');
    avatarContainer.style.display = 'flex';
    avatarContainer.style.gap = '20px';
    avatarContainer.style.alignItems = 'center';
    avatarContainer.style.flexWrap = 'wrap';
    avatarContainer.style.padding = '20px';
    avatarContainer.style.background = '#F9F9F9';
    avatarContainer.style.borderRadius = '16px';
    avatarSection.appendChild(avatarContainer);

    await renderAvatar(avatarContainer, { name: 'JD', size: AVATAR_SIZES.SMALL });
    await renderAvatar(avatarContainer, { name: 'AS', size: AVATAR_SIZES.MEDIUM });
    await renderAvatar(avatarContainer, { name: 'KZ', size: AVATAR_SIZES.LARGE });
    await renderAvatar(avatarContainer, { name: 'RS', size: AVATAR_SIZES.XLARGE });

    // С длинным именем
    await renderAvatar(avatarContainer, { 
        name: 'Переславль-Залесская Анна', 
        size: AVATAR_SIZES.MEDIUM,
        onClick: (user) => console.log('Clicked avatar')
    });

    // ===== 4. ДЕМО USERPHOTOITEM =====
    const photoSection = document.createElement('div');
    photoSection.innerHTML = '<h2 style="margin: 40px 0 20px; font-family: var(--font-heading);">UserPhotoItem - список пользователей</h2>';
    demoContainer.appendChild(photoSection);

    const { renderUserPhotoItem, renderUserPhotoList } = await import('/components/atoms/UserPhotoItem/UserPhotoItem.js');

    // Обычный список
    const regularList = document.createElement('div');
    regularList.className = 'user-photo-list';
    photoSection.appendChild(regularList);

    const users = [
        { id: 1, name: 'Ярослав-Лют Владимиров', role: 'Физолог' },
        { id: 2, name: 'Антон Переславль-Залесский', role: 'Тренер ОФП' },
        { id: 3, name: 'Ксения Бортникова', role: 'Тренер по конкуру' },
        { id: 4, name: 'Софья Заяц', role: 'Спортсмен' }
    ];

    for (const user of users) {
        await renderUserPhotoItem(regularList, {
            ...user,
            onClick: (u) => console.log('Clicked:', u)
        });
    }

    // Компактный режим
    const compactTitle = document.createElement('h3');
    compactTitle.className = 'user-photo-section-title';
    compactTitle.textContent = 'Компактный режим (для длинных списков):';
    compactTitle.style.marginTop = '40px';
    photoSection.appendChild(compactTitle);

    const compactList = document.createElement('div');
    compactList.className = 'user-photo-list';
    photoSection.appendChild(compactList);

    // Генерируем 5 пользователей с длинными именами
    for (let i = 1; i <= 5; i++) {
        await renderUserPhotoItem(compactList, {
            id: i + 10,
            name: `Пользователь ${i} с очень длинным именем для проверки обрезания`,
            role: 'Роль',
            compact: true
        });
    }

    // Empty states
    const emptyTitle = document.createElement('h3');
    emptyTitle.className = 'user-photo-section-title';
    emptyTitle.textContent = 'Empty state (нет данных):';
    emptyTitle.style.marginTop = '40px';
    photoSection.appendChild(emptyTitle);

    const emptyList = document.createElement('div');
    emptyList.className = 'user-photo-list';
    photoSection.appendChild(emptyList);

    await renderUserPhotoItem(emptyList, {
        isEmpty: true,
        emptyMessage: 'По вашему запросу ничего не найдено'
    });

    await renderUserPhotoItem(emptyList, {
        isEmpty: true,
        emptyMessage: 'У вас нет новых подписок'
    });
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadTemplates();
    await demoAllComponents();
});
