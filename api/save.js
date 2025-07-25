// api/save.js - упрощенная версия для диагностики
export default async function handler(req, res) {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== SAVE API ДИАГНОСТИКА ===');
    console.log('Request body:', req.body);
    console.log('Environment variables check...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SUPABASE_ANON_KEY exists:', !!supabaseKey);
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Environment variables missing',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      });
    }

    // Пока просто возвращаем успех без реального сохранения
    console.log('✅ Симуляция сохранения данных');
    
    return res.json({ 
      success: true, 
      message: 'Данные получены (тестовый режим)',
      debug: {
        timestamp: new Date().toISOString(),
        receivedData: {
          hasInitData: !!req.body?.initData,
          tasksCount: req.body?.tasks?.length || 0,
          notesCount: req.body?.notes?.length || 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка в save API:', error);
    return res.status(500).json({ 
      error: 'Server error: ' + error.message,
      stack: error.stack
    });
  }
}
