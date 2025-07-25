// api/load.js - упрощенная версия для диагностики
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
    // Проверяем переменные окружения
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('=== ДИАГНОСТИКА API ===');
    console.log('SUPABASE_URL exists:', !!supabaseUrl);
    console.log('SUPABASE_URL value:', supabaseUrl);
    console.log('SUPABASE_ANON_KEY exists:', !!supabaseKey);
    console.log('SUPABASE_ANON_KEY length:', supabaseKey ? supabaseKey.length : 0);
    console.log('Query params:', req.query);
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Отсутствуют environment variables');
      return res.status(500).json({ 
        error: 'Environment variables not configured',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      });
    }

    // Временно возвращаем тестовые данные
    console.log('✅ Возвращаем тестовые данные');
    return res.json({
      tasks: [
        {
          id: 'test1',
          text: 'Тестовая задача из API',
          completed: false,
          createdAt: new Date().toISOString()
        }
      ],
      notes: [
        {
          id: 'test2', 
          text: 'Тестовая заметка из API',
          createdAt: new Date().toISOString()
        }
      ],
      debug: {
        timestamp: new Date().toISOString(),
        environment: 'working'
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка в API:', error);
    return res.status(500).json({ 
      error: 'Server error: ' + error.message,
      stack: error.stack
    });
  }
}
