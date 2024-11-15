// api.js
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app = express();

// CORS configuration
app.use(cors({
	origin: '*',
	methods: ['GET']
}));

// Root route for Passenger health check
app.get('/', (req, res) =>
{
	res.status(200).send('API is running');
});

// Route for attendance data
app.get('/attendance', (req, res) =>
{
	const attendanceFile = path.join(__dirname, 'data', 'attendance.json');

	try
	{
		if(!fs.existsSync(attendanceFile))
		{
			return res.status(200).json([]);
		}

		const attendanceData = JSON.parse(fs.readFileSync(attendanceFile, 'utf8'));
		res.status(200).json(attendanceData);
	}
	catch(error)
	{
		console.error('Error reading attendance data:', error);
		res.status(500).json({error: 'Internal Server Error'});
	}
});

// Handle 404
app.use((req, res) =>
{
	res.status(404).json({error: 'Not Found'});
});

// Export app for Passenger
module.exports = app;
