import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  View,
  Modal,
} from "react-native";
import { DataStore } from "@aws-amplify/datastore";
import { Note, User } from "./src/models";
import { Amplify } from "aws-amplify";
import config from "./src/aws-exports";
import NetInfo from "@react-native-community/netinfo";


Amplify.configure(config);

interface ExtendedNote extends Note {
  _deleted?: boolean;
}

const App = () => {
  const [content, setContent] = useState<string>("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [isSynced, setIsSynced] = useState<boolean>(false);

   useEffect(() => {
     fetchNotes();

     const subscription = DataStore.observe(Note).subscribe(() => fetchNotes());

     return () => subscription.unsubscribe();
   }, []);

   useEffect(() => {
     const subscription = DataStore.observe(Note).subscribe((msg) => {
       console.log("Subscription message:", msg);
       if (msg.opType === "INSERT") {
         console.log("A new note was added:", msg.element);
       } else if (msg.opType === "UPDATE") {
         console.log("A note was updated:", msg.element);
       } else if (msg.opType === "DELETE") {
         console.log("A note was deleted:", msg.element);
       }
     });

     return () => subscription.unsubscribe();
   }, []);

   useEffect(() => {
     const handleSync = async () => {
       try {
         await DataStore.start();
         console.log("DataStore started!");
       } catch (error) {
         console.error("Error starting DataStore", error);
       }
     };

     const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
       if (state.isConnected) {
         handleSync();
       }
     });

     handleSync();

     return () => unsubscribeNetInfo();
   }, []);

   async function fetchNotes() {
     try {
       const notesData = await DataStore.query(Note) as ExtendedNote[];
       setNotes(notesData.filter((note) => !note._deleted));
     } catch (err) {
       console.error("Error fetching notes:", err);
     }
   }

  const TEMP_USERNAME = "demo_user";
  async function ensureUserExists() {
    let user = await DataStore.query(User, (u) =>
      u.username.eq(TEMP_USERNAME)
    ).then((users) => users[0]);
    if (!user) {
      user = await DataStore.save(new User({ username: TEMP_USERNAME }));
    }
    return user;
  }

  useEffect(() => {
    ensureUserExists().then((tempUserId) => {
      console.log("Temporary User ID:", tempUserId);
    });
  }, []);

  let tempOwnerId = "";
  let user = null;
  async function createNote() {
    if (!content) return;

    if (!tempOwnerId) {
      const user = await ensureUserExists();
      tempOwnerId = user.id;
    }

    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    try {
      await DataStore.save(
        new Note({
          content: content,
          createdAt: createdAt,
          updatedAt: updatedAt,
          ownerId: tempOwnerId,
        })
      );
      console.log("Note created successfully");
      console.log()
    } catch (err) {
      console.error("Error creating note:", err);
    }

    setContent("");
    fetchNotes();
  }

  async function deleteNoteById(noteId: string) {
    try {
      const noteToDelete = await DataStore.query(Note, noteId);
      if (noteToDelete) {
        await DataStore.delete(noteToDelete);
        console.log("Note deleted successfully");
        setNotes((currentNotes) =>
          currentNotes.filter((note) => note.id !== noteId)
        );
      }
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  }

  async function updateNoteContent(noteId: string, newContent: string) {
    try {
      const noteToUpdate = await DataStore.query(Note, noteId);
      if (noteToUpdate) {
        await DataStore.save(
          Note.copyOf(noteToUpdate, (updated) => {
            updated.content = newContent;
          })
        );
        console.log("Note updated successfully");
        setEditContent("");
        fetchNotes();
      }
    } catch (err) {
      console.error("Error updating note:", err);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Write a note"
        style={styles.input}
      />
      <Button title="Add Note" onPress={createNote} />
      <FlatList
        data={notes}
        renderItem={({ item }) => (
          <View style={styles.noteItem}>
            <Text style={styles.noteContent}>{item.content}</Text>
            <View style={styles.buttonsContainer}>
              <Button title="Delete" onPress={() => deleteNoteById(item.id)} />
              <Button
                title="Edit"
                onPress={() => {
                  setEditingNote(item);
                  setEditContent(item.content);
                  setIsEditModalVisible(true);
                }}
              />
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => {
          setIsEditModalVisible(!isEditModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <TextInput
              style={styles.modalText}
              onChangeText={setEditContent}
              value={editContent}
            />
            <Button
              title="Save"
              onPress={() => {
                if (editingNote) updateNoteContent(editingNote.id, editContent);
                setIsEditModalVisible(!isEditModalVisible);
                setEditingNote(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ 
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  noteItem: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteContent: {
    fontSize: 16,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 100,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
});

export default App;
