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
  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<string>("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

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
      const notesData = (await DataStore.query(Note)) as ExtendedNote[];
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

  async function handleSaveNote() {
    const user = await ensureUserExists();
    if (editingNoteId) {
      const originalNote = await DataStore.query(Note, editingNoteId);
      if (originalNote) {
        // Check if the note actually exists
        await DataStore.save(
          Note.copyOf(originalNote, (updated) => {
            updated.content = modalContent;
          })
        );
      } else {
        console.error("Note not found, unable to update");
      }
    } else {
      // Create a new note if editingNoteId is not set
      await DataStore.save(
        new Note({
          content: modalContent,
          ownerId: user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    }
    // Reset states and fetch notes again
    setModalContent("");
    setEditingNoteId(null);
    setIsModalVisible(false);
    fetchNotes();
  }

  function openModalForNewNote() {
    setModalContent("");
    setEditingNoteId(null);
    setIsModalVisible(true);
  }

  function openModalForEdit(note: Note) {
    setModalContent(note.content);
    setEditingNoteId(note.id);
    setIsModalVisible(true);
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

  return (
    <SafeAreaView style={styles.container}>
      <Button title="Add Note" onPress={openModalForNewNote} />
      <FlatList
        data={notes}
        renderItem={({ item }) => (
          <View style={styles.noteItem}>
            <Text style={styles.noteContent}>{item.content}</Text>
            <Button title="Edit" onPress={() => openModalForEdit(item)} />
            <Button title="Delete" onPress={() => deleteNoteById(item.id)} />
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <TextInput
              style={styles.modalTextInput}
              onChangeText={setModalContent}
              value={modalContent}
              placeholder="Note Content"
              multiline
              numberOfLines={10} // Adjust this to change the initial height of the TextInput
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setIsModalVisible(false)} />
              <Button title="Save Note" onPress={handleSaveNote} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Other styles remain unchanged
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Adding a semi-transparent background
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
    width: "80%", // Ensuring the modal is 80% of screen width
    maxHeight: "60%", // Ensuring the modal height doesn't exceed 60% of screen height
  },
  modalTextInput: {
    width: "100%", // Making TextInput take the full width of the modal
    minHeight: 100, // Minimum height to ensure it's not too small
    borderColor: "gray",
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 5, // Adding some rounded corners
    textAlignVertical: "top", // Ensure multiline text starts at the top
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%", // Buttons span the full width of the modal
  },
  // Revert any changes that negatively affected the list of notes
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
});

export default App;
