// Envoltura del cliente de Groq (API compatible con OpenAI).
// La API key vive SOLO aquí (en el servidor). Nunca se manda al navegador.
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
const MODEL = process.env.MODEL || 'openai/gpt-oss-20b';

// Manda un prompt y devuelve el texto plano de la respuesta.
// reasoning_effort:'low' evita que el modelo (gpt-oss es un modelo "de razonamiento")
// gaste el presupuesto de tokens pensando y se quede sin espacio para responder.
export async function complete(prompt) {
  const res = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    reasoning_effort: 'low',
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content || '';
}
