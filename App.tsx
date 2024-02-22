import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { DataStore } from "@aws-amplify/datastore";
import { Note } from "./src/models"; // Adjust based on your actual path
import { Amplify } from "aws-amplify";
import config from "./src/aws-exports"; // Your path might vary

Amplify.configure(config);

const App = () => {
  const [content, setContent] = useState<string>("");
  // Explicitly type the notes state with Note[]
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    const notesData = await DataStore.query(Note);
    setNotes(notesData);
  }

  async function createNote() {
    if (!content) return;

    const ownerId = "temporary-owner-id";
    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    try {
      await DataStore.save(
        new Note({
          content: content,
          createdAt: createdAt,
          updatedAt: updatedAt,
          ownerId: ownerId,
        })
      );
      console.log("Note created successfully");
    } catch (err) {
      console.error("Error creating note:", err);
      // Handle the error appropriately in your UI, possibly setting an error state
    }

    setContent("");
    fetchNotes(); // Refresh the list of notes after adding a new one
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
          </View>
        )}
        keyExtractor={(item) => item.id}
      />
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
  },
  noteContent: {
    fontSize: 16,
  },
});

export default App;
