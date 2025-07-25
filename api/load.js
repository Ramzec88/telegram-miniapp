// api/load.js - исправленная версия с правильным SQL
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
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Environment variables отсутствуют');
      return res.status(500).json({ 
        error: 'Environment variables not configured',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      });
    }

    // Если нет initData - возвращаем пустые данные
    if (!initData || initData === 'test') {
      console.log('⚠️ Нет настоящего initData - возвращаем пустые данные');
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

    // Инициализируем Supabase клиент
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    console.log('✅ Supabase клиент создан');

    // Тестируем подключение к Supabase (ИСПРАВЛЕННЫЙ запрос)
    try {
      console.log('Тестируем подключение к Supabase...');
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Тест подключения неудачен:', error);
        throw new Error('Supabase connection failed: ' + error.message);
      }
      console.log('✅ Подключение к Supabase работает');
    } catch (connectionError) {
      console.error('❌ Критическая ошибка подключения:', connectionError);
      
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

    // Загружаем задачи из Supabase
    console.log('Загружаем задачи...');
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, text, completed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (tasksError) {
      console.error('❌ Ошибка загрузки задач:', tasksError);
      throw new Error('Tasks load error: ' + tasksError.message);
    }
    console.log('✅ Задачи загружены:', tasks?.length || 0);

    // Загружаем заметки из Supabase
    console.log('Загружаем заметки...');
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, text, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (notesError) {
      console.error('❌ Ошибка загрузки заметок:', notesError);
      throw new Error('Notes load error: ' + notesError.message);
    }
    console.log('✅ Заметки загружены:', notes?.length || 0);

    // Преобразуем в формат приложения
    const formattedTasks = (tasks || []).map(task => ({
      id: task.id,
      text: task.text,
      completed: task.completed,
      createdAt: task.created_at
    }));

    const formattedNotes = (notes || []).map(note => ({
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
        mode: 'supabase-success'
      }
    });
    
  } catch (error) {
    console.error('=== LOAD API ERROR ===');
    console.error('Полная ошибка:', error);
    res.status(500).json({ 
      error: 'Server error: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
