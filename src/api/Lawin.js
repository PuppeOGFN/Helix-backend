import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import log from '../Utils/log.js';

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
  })
  .catch((err) => {
    log.error(`MongoDB connection error: ${err}`);
  });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
});

const User = mongoose.model('User', userSchema);

app.get('/api/v1/checkUser/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });

    if (user) {
      res.status(200).send('Valid');
    } else {
      res.status(404).send('Invalid');
    }
  } catch (error) {
    log.error(`Error checking user: ${error}`);
    res.status(500).send('Server Error');
  }
});

const PORT = 94;
app.listen(PORT, () => {
  log.api(`Lawin server running on port ${PORT}`);
});