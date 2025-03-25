import 'package:flutter/material.dart';

class InitPage extends StatefulWidget {
  const InitPage({Key? key}) : super(key: key);

  @override
  State<InitPage> createState() => _InitPageState();
}

class _InitPageState extends State<InitPage> {
  @override
  void initState() {
    // TODO: implement initState
    super.initState();

    //Flutter not allow to move immediately in init, so we have to wait
    Future<void>.delayed(Duration.zero, () {
      Navigator.pushReplacementNamed(context, '/home');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

