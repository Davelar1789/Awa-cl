'use strict'

// Runs before the test framework is installed, for every test file.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long'
process.env.JWT_EXPIRES_IN = '1h'
process.env.ARKESEL_MOCK_MODE = 'true'
process.env.ATTENDANCE_CUTOFF_TIME = '06:30'
process.env.DEFAULT_GEOFENCE_RADIUS_METRES = '500'
