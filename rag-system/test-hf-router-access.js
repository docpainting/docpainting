require('dotenv').config();

async function query(data) {
	const response = await fetch(
		"https://router.huggingface.co/v1/chat/completions",
		{
			headers: {
				Authorization: `Bearer ${process.env.HF_TOKEN}`,
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

console.log('🧪 Testing Hugging Face Router Access');
console.log('=====================================');
console.log(`🔑 Using token: ${process.env.HF_TOKEN?.substring(0, 10)}...`);

query({ 
    messages: [
        {
            role: "user",
            content: "What is the capital of France?",
        },
    ],
    model: "Qwen/Qwen3-Coder-480B-A35B-Instruct:novita",
}).then((response) => {
    console.log('✅ SUCCESS! Router responded:');
    console.log(JSON.stringify(response, null, 2));
    console.log('\n🎯 This proves your HF token has router access!');
}).catch((error) => {
    console.error('❌ ERROR accessing router:');
    console.error(error.message);
    console.log('\n💡 This suggests an access or authentication issue.');
});
