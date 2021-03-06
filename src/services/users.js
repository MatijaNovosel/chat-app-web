import { firebase } from "src/boot/firebase";
import {
  range,
  sample,
  readDocuments,
  checkUsernamePattern,
  generateGuid
} from "src/utils/helpers";

class UserService {
  constructor() {
    this.userCollection = firebase.firestore().collection("/users");
  }

  async getAll() {
    const users = await this.userCollection.get();
    const retVal = [];
    users.forEach((snapshot) => {
      const data = snapshot.data();
      retVal.push({
        username: data.username,
        email: data.email
      });
    });
    return retVal;
  }

  async addUser(user) {
    const { id, email, username } = user;
    await this.userCollection.doc(id).set({
      username,
      email,
      shorthandId: range(6)
        .map(() => sample(range(6)).toString())
        .join(""),
      lang: "en"
    });
  }

  async getDetails(uid) {
    const user = await this.userCollection.doc(uid).get();
    const invites = await this.userCollection.doc(uid).collection("/invites").get();

    const invitesMapped = [];
    invites.forEach((i) => {
      if (!i.data().confirmed) {
        invitesMapped.push({ id: i.id, ...i.data() });
      }
    });

    return { invites: invitesMapped, ...user.data() };
  }

  async searchByUsername(existingUsers, searchQuery) {
    if (checkUsernamePattern(searchQuery)) {
      const username = searchQuery.split("#")[0];
      const shorthandId = searchQuery.split("#")[1];

      const res = await readDocuments("users", {
        where: [
          ["username", "==", username],
          ["shorthandId", "==", shorthandId]
        ]
      });

      const users = [];

      res.forEach((r) => {
        const data = r.data();

        if (existingUsers) {
          if (!existingUsers.some((u) => u === `${data.username}#${data.shorthandId}`)) {
            users.push({ id: r.id, ...r.data() });
          }
        } else {
          users.push({ id: r.id, ...r.data() });
        }
      });

      return users;
    }
    return [];
  }

  async uploadProfilePicture(file, userId) {
    const guid = generateGuid();
    const retVal = await firebase.storage().ref(guid).put(file);
    const url = await retVal.ref.getDownloadURL();
    await this.userCollection.doc(userId).update({
      avatarUrl: url
    });
    return url;
  }

  async updatePrivileges(newPrivileges, userId, chatId) {
    const chat = await firebase.firestore().collection("/chats").doc(chatId).get();
    const users = chat.data().users;
    await firebase
      .firestore()
      .collection("/chats")
      .doc(chatId)
      .update({
        users: users.map((user) => {
          if (user.id === userId) {
            user.privileges = newPrivileges;
          }
          return user;
        })
      });
  }

  async updateLanguage(lang, userId) {
    await this.userCollection.doc(userId).update({
      lang
    });
  }
}

export default new UserService();
