import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:url_strategy/url_strategy.dart';
import 'package:what_dish_to_cook_today/pages/dish_detail_page/dish_detail_page.dart';
import 'package:what_dish_to_cook_today/pages/dish_selection_page/dish_selection_page.dart';

import 'package:what_dish_to_cook_today/pages/home_page/home_page.dart';
import 'package:what_dish_to_cook_today/pages/init_page/init_page.dart';


void main() {
  // Here we set the URL strategy for our web app.
  // It is safe to call this function when running on mobile or desktop as well.
  setPathUrlStrategy();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'What dish to cook today',
      theme: ThemeData(
        // This is the theme of your application.
        //
        // Try running your application with "flutter run". You'll see the
        // application has a blue toolbar. Then, without quitting the app, try
        // changing the primarySwatch below to Colors.green and then invoke
        // "hot reload" (press "r" in the console where you ran "flutter run",
        // or simply save your changes to "hot reload" in a Flutter IDE).
        // Notice that the counter didn't reset back to zero; the application
        // is not restarted.
        primarySwatch: Colors.blue,
      ),
      //initialRoute: "/",
      initialRoute: "/home",
      routes: {
        '/' : (context) => const InitPage(),
        '/home' : (context) => const HomePage(),
        '/dish_selection' : (context) => const DishSelectionPage(),
        '/dish_detail' : (context) => const DishDetailPage(),
      },
      //Because scroll of some library not working on window, so we have to update scrollBehavior
      //->And it working :D
      scrollBehavior: MyCustomScrollBehavior(),
    );
  }
}

class MyCustomScrollBehavior extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    // etc.
  };
}