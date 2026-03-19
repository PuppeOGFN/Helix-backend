import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    created: { type: Date, required: true },
    banned: { type: Boolean, default: false },
    discordId: { type: String, required: true, unique: true },
    accountId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    username_lower: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mfa: { type: Boolean, default: false },
    canCreateCodes: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    played: { type: Boolean, default: false },
    tournamentHype: { type: Number, default: 0 },
    tournamentDetails: {
      type: {
        kills: { type: Number, default: 0 },
        placement: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        matchesPlayed: { type: Number, default: 0 },
        matches: {
          type: [
            {
              placement: { type: Number, required: true },
              placementPoints: { type: Number, required: true },
              kills: { type: Number, required: true },
              killPoints: { type: Number, required: true },
              timeAlive: { type: Number, required: true },
              victory: { type: Number, required: true },
            },
          ],
          default: [],
        },
      },
      default: {
        kills: 0,
        placement: 0,
        points: 0,
        wins: 0,
        matchesPlayed: 0,
        matches: [],
      },
      required: false,
    },
  },
  {
    collection: "users",
  }
);

const model = mongoose.model("UserSchema", UserSchema);
export default model;