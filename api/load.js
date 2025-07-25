// api/load.js - версия с улучшенной обработкой ошибок
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData } = req.query;
    
    console.log('=== LOAD API START ===');
    console.log('initData получен:', !!initData);
    
    // Проверяем environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SUPABASE_ANON_KEY exists:', !!supabaseKey);
    console.log('SUPABASE_ANON_KEY length:', supabaseKey ? supabaseKey.length : 0);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Environment variables отсутствуют');
      return res.status(500).json({ 
        error: 'Environment variables not configured',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          url: supabaseUrl
        }
      });
    }

    // Если нет initData - возвращаем пустые данные
    if (!initData) {
      console.log('⚠️ Нет initData - возвращаем пустые данные');
      return res.json({
        tasks: [],
        notes: [],
        debug: {
          mode: 'no-auth',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Парсинг данных пользователя
    const urlParams = new URLSearchParams(initData);
    const userDataStr = urlParams.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!user) {
      console.error('❌ Данные пользователя не найдены');
      return res.status(400).json({ error: 'User data not found in initData' });
    }

    console.log('✅ Пользователь найден:', user.first_name, '(ID:', user.id, ')');

    // Инициализируем Supabase клиент с дополнительными настройками
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'User-Agent': 'telegram-miniapp/1.0'
        }
      }
    });
    console.log('✅ Supabase клиент создан');

    // Тестируем подключение к Supabase
    console.log('Тестируем подключение к Supabase...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (testError) {
        console.error('❌ Тест подключения к Supabase неудачен:', testError);
        throw new Error('Supabase connection test failed: ' + testError.message);
      }
      console.log('✅ Подключение к Supabase работает');
    } catch (connectionError) {
      console.error('❌ Ошибка подключения к Supabase:', connectionError);
      
      // Возвращаем пустые данные при ошибке подключения
      return res.json({
        tasks: [],
        notes: [],
        debug: {
          mode: 'connection-error',
          error: connectionError.message,
          timestamp: new Date().toISOString(),
          userId: user.id
        }
      });
    }

    let tasks = [];
    let notes = [];

    // Загружаем задачи с повторными попытками
    console.log('Загружаем задачи...');
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, text, completed, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (tasksError) {
        console.error('❌ Ошибка загрузки задач:', tasksError);
        // Не прерываем выполнение, продолжаем с пустыми задачами
      } else {
        tasks = tasksData || [];
        console.log('✅ Задачи загружены:', tasks.length);
      }
    } catch (tasksLoadError) {
      console.error('❌ Критическая ошибка загрузки задач:', tasksLoadError);
      // Продолжаем с пустыми задачами
    }

    // Загружаем заметки с повторными попытками
    console.log('Загружаем заметки...');
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, text, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (notesError) {
        console.error('❌ Ошибка загрузки заметок:', notesError);
        // Не прерываем выполнение, продолжаем с пустыми заметками
      } else {
        notes = notesData || [];
        console.log('✅ Заметки загружены:', notes.length);
      }
    } catch (notesLoadError) {
      console.error('❌ Критическая ошибка загрузки заметок:', notesLoadError);
      // Продолжаем с пустыми заметками
    }

    // Преобразуем в формат приложения
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      text: task.text,
      completed: task.completed,
      createdAt: task.created_at
    }));

    const formattedNotes = notes.map(note => ({
      id: note.id,
      text: note.text,
      createdAt: note.created_at
    }));

    console.log('=== LOAD API SUCCESS ===');
    res.json({
      tasks: formattedTasks,
      notes: formattedNotes,
      debug: {
        timestamp: new Date().toISOString(),
        userId: user.id,
        loadedTasks: formattedTasks.length,
        loadedNotes: formattedNotes.length,
        mode: 'success'
      }
    });
    
  } catch (error) {
    console.error('=== LOAD API ERROR ===');
    console.error('Тип ошибки:', error.name);
    console.error('Сообщение:', error.message);
    console.error('Stack:', error.stack);
    
    // Возвращаем частичный успех вместо полной ошибки
    res.status(200).json({ 
      tasks: [],
      notes: [],
      debug: {
        mode: 'error-fallback',
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    });
  }
}
